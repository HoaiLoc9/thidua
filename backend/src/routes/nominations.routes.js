const express = require("express");
const fs = require("fs");
const path = require("path");
const multer = require("multer");
const crypto = require("crypto");
const { z } = require("zod");
const prisma = require("../lib/prisma");
const { authenticate } = require("../middlewares/auth");
const { logAudit } = require("../utils/audit");
const { createNotification } = require("../utils/notify");
const { assertFileSignature, calculateSHA256, scanFileWithClamAV } = require("../utils/fileSecurity");

const router = express.Router();

const evidenceDir = path.join(__dirname, "..", "..", "uploads", "evidences");
const quarantineDir = path.join(__dirname, "..", "..", "uploads", "quarantine");
fs.mkdirSync(evidenceDir, { recursive: true });
fs.mkdirSync(quarantineDir, { recursive: true });

const allowedEvidenceExtensions = new Set([".pdf", ".docx", ".xlsx", ".png", ".jpg", ".jpeg", ".zip"]);
const allowedEvidenceMimeTypes = new Set([
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "image/png",
  "image/jpeg",
  "application/zip",
  "application/x-zip-compressed",
  "multipart/x-zip",
]);

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, quarantineDir),
  filename: (req, file, cb) => {
    const extension = path.extname(file.originalname || "").toLowerCase();
    cb(null, `${Date.now()}-${crypto.randomUUID()}${extension}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const extension = path.extname(file.originalname || "").toLowerCase();
    const isAllowedExtension = allowedEvidenceExtensions.has(extension);
    const isAllowedMime = allowedEvidenceMimeTypes.has((file.mimetype || "").toLowerCase());

    if (isAllowedExtension && isAllowedMime) {
      cb(null, true);
      return;
    }

    const validationError = new Error("Chi duoc nop minh chung dang PDF, DOCX, XLSX, PNG/JPG hoac ZIP");
    validationError.status = 400;
    cb(validationError);
  },
});

const itemSchema = z.object({
  criteriaId: z.number().int().positive(),
  selfPoint: z.number().int().min(0),
  evidence: z.string().optional(),
});

const nominationSchema = z.object({
  title: z.string().min(3),
  periodYear: z.number().int().min(2020),
  items: z.array(itemSchema).min(1),
});

async function secureUploadedFile(file) {
  if (!file) {
    const error = new Error("Vui long chon tep minh chung");
    error.status = 400;
    throw error;
  }

  const extension = path.extname(file.originalname || "").toLowerCase();
  await assertFileSignature(file.path, extension);

  const hash = await calculateSHA256(file.path);
  const scanResult = await scanFileWithClamAV(file.path);
  // Default best-effort mode: if ClamAV is temporarily unavailable, keep file as pending scan
  // to avoid blocking user workflow. Set ALLOW_UNSCANNED_UPLOADS=false for strict mode.
  const allowPendingOnScanError = process.env.ALLOW_UNSCANNED_UPLOADS !== "false";

  if (scanResult.status === "INFECTED") {
    await fs.promises.unlink(file.path).catch(() => null);
    const error = new Error("Tep tai len bi phat hien ma doc va da bi tu choi");
    error.status = 400;
    throw error;
  }

  if (scanResult.status === "SCAN_ERROR" && !allowPendingOnScanError) {
    await fs.promises.unlink(file.path).catch(() => null);
    const error = new Error("Khong the quet ma doc luc nay. Vui long thu lai sau");
    error.status = 503;
    throw error;
  }

  const finalPath = path.join(evidenceDir, file.filename);
  await fs.promises.rename(file.path, finalPath);

  return {
    fileUrl: `/uploads/evidences/${file.filename}`,
    fileHash: hash,
    scanStatus: scanResult.status === "CLEAN" ? "CLEAN" : "PENDING_SCAN",
    scanDetail: scanResult.status === "SCAN_ERROR" ? scanResult.detail : scanResult.detail || null,
    scannedAt: scanResult.status === "CLEAN" ? new Date() : null,
  };
}

async function calculateTotal(items) {
  return items.reduce((sum, item) => sum + item.selfPoint, 0);
}

function addDays(date, days) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function resolveDueDateByLevel(level) {
  const now = new Date();
  const dayByLevel = {
    DONVI: Number(process.env.REVIEW_DUE_DONVI_DAYS || 3),
    KHOA: Number(process.env.REVIEW_DUE_KHOA_DAYS || 5),
    TRUONG: Number(process.env.REVIEW_DUE_TRUONG_DAYS || 7),
  };
  return addDays(now, dayByLevel[level] || 5);
}

function normalizeItemsForRole(items, role) {
  if (role !== "SINHVIEN") {
    return items;
  }

  return items.map((item) => ({
    ...item,
    selfPoint: 0,
  }));
}

router.get("/", authenticate, async (req, res, next) => {
  try {
    const where = ["GIANGVIEN", "SINHVIEN"].includes(req.user.role)
      ? { applicantId: req.user.id }
      : {};

    const data = await prisma.nomination.findMany({
      where,
      include: {
        applicant: {
          select: { id: true, fullName: true, email: true, department: true },
        },
        items: {
          include: {
            criteria: {
              include: {
                subItems: {
                  orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
                },
              },
            },
          },
        },
        reviews: {
          include: {
            reviewer: {
              select: { id: true, fullName: true, role: true },
            },
          },
          orderBy: { id: "asc" },
        },
        evidences: {
          orderBy: { uploadedAt: "desc" },
        },
      },
      orderBy: { updatedAt: "desc" },
    });

    return res.json(data);
  } catch (error) {
    return next(error);
  }
});

router.post("/", authenticate, async (req, res, next) => {
  try {
    if (!["GIANGVIEN", "SINHVIEN"].includes(req.user.role)) {
      return res.status(403).json({ message: "Chi giang vien/sinh vien moi tao ho so" });
    }

    const payload = nominationSchema.parse(req.body);
    const items = normalizeItemsForRole(payload.items, req.user.role);
    const totalSelfPoint = await calculateTotal(items);

    const created = await prisma.$transaction(async (tx) => {
      const nomination = await tx.nomination.create({
        data: {
          title: payload.title,
          periodYear: payload.periodYear,
          applicantId: req.user.id,
          totalSelfPoint,
          items: {
            create: items,
          },
        },
        include: {
          items: true,
        },
      });

      const evidenceRows = items
        .filter((item) => item.evidence && item.evidence.trim())
        .map((item) => ({
          nominationId: nomination.id,
          fileUrl: item.evidence.trim(),
          description: `Minh chung tieu chi ${item.criteriaId}`,
          scanStatus: "CLEAN",
        }));

      if (evidenceRows.length) {
        await tx.evidence.createMany({ data: evidenceRows });
      }

      return nomination;
    });

    await logAudit(req.user.id, "CREATE_NOMINATION", `Created nomination ${created.id}`);

    return res.status(201).json(created);
  } catch (error) {
    return next(error);
  }
});

router.put("/:id", authenticate, async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const payload = nominationSchema.parse(req.body);

    const existed = await prisma.nomination.findUnique({ where: { id } });
    if (!existed) {
      return res.status(404).json({ message: "Khong tim thay ho so" });
    }

    if (existed.applicantId !== req.user.id && ["GIANGVIEN", "SINHVIEN"].includes(req.user.role)) {
      return res.status(403).json({ message: "Khong co quyen sua ho so nay" });
    }

    if (existed.status !== "DRAFT") {
      return res.status(400).json({ message: "Chi ho so DRAFT moi duoc cap nhat" });
    }

    const items = normalizeItemsForRole(payload.items, req.user.role);
    const totalSelfPoint = await calculateTotal(items);

    const updated = await prisma.$transaction(async (tx) => {
      const nomination = await tx.nomination.update({
        where: { id },
        data: {
          title: payload.title,
          periodYear: payload.periodYear,
          totalSelfPoint,
          items: {
            deleteMany: {},
            create: items,
          },
        },
        include: {
          items: true,
        },
      });

      await tx.evidence.deleteMany({ where: { nominationId: id } });
      const evidenceRows = items
        .filter((item) => item.evidence && item.evidence.trim())
        .map((item) => ({
          nominationId: id,
          fileUrl: item.evidence.trim(),
          description: `Minh chung tieu chi ${item.criteriaId}`,
          scanStatus: "CLEAN",
        }));

      if (evidenceRows.length) {
        await tx.evidence.createMany({ data: evidenceRows });
      }

      return nomination;
    });

    await logAudit(req.user.id, "UPDATE_NOMINATION", `Updated nomination ${updated.id}`);

    return res.json(updated);
  } catch (error) {
    return next(error);
  }
});

router.post("/:id/submit", authenticate, async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const nomination = await prisma.nomination.findUnique({ where: { id } });

    if (!nomination) {
      return res.status(404).json({ message: "Khong tim thay ho so" });
    }

    if (nomination.applicantId !== req.user.id) {
      return res.status(403).json({ message: "Khong co quyen nop ho so nay" });
    }

    if (nomination.status !== "DRAFT") {
      return res.status(400).json({ message: "Ho so da duoc nop" });
    }

    const process = await prisma.approvalProcess.findFirst({
      include: { steps: { orderBy: { stepOrder: "asc" } } },
      orderBy: { updatedAt: "desc" },
    });

    let reviewers = [];
    if (process?.steps?.length) {
      const roleCounter = {};
      for (const step of process.steps) {
        roleCounter[step.role] = (roleCounter[step.role] || 0) + 1;
        const users = await prisma.user.findMany({
          where: { role: step.role },
          orderBy: { id: "asc" },
        });
        const reviewer = users[roleCounter[step.role] - 1] || users[0];
        if (!reviewer) {
          return res.status(400).json({
            message: `Khong tim thay nguoi duyet cho vai tro ${step.role}`,
          });
        }
        const level = step.stepOrder === 1 ? "DONVI" : step.stepOrder === 2 ? "KHOA" : "TRUONG";
        reviewers.push({ reviewerId: reviewer.id, level });
      }
    } else {
      const canbos = await prisma.user.findMany({
        where: { role: "CANBO" },
        orderBy: { id: "asc" },
        take: 2,
      });
      const hoidong = await prisma.user.findFirst({
        where: { role: "HOIDONG" },
        orderBy: { id: "asc" },
      });
      const admin = await prisma.user.findFirst({
        where: { role: "ADMIN" },
        orderBy: { id: "asc" },
      });

      if (canbos.length === 0 || (!hoidong && !admin)) {
        return res.status(400).json({
          message: "Can co it nhat 1 CANBO va 1 HOIDONG/ADMIN de thuc hien quy trinh duyet",
        });
      }

      reviewers = [
        { reviewerId: canbos[0].id, level: "DONVI" },
        { reviewerId: canbos[1] ? canbos[1].id : canbos[0].id, level: "KHOA" },
        { reviewerId: hoidong ? hoidong.id : admin.id, level: "TRUONG" },
      ];
    }

    const result = await prisma.$transaction(async (tx) => {
      await tx.nomination.update({
        where: { id },
        data: { status: "SUBMITTED" },
      });

      await tx.reviewStep.createMany({
        data: reviewers.map((r) => ({
          nominationId: id,
          reviewerId: r.reviewerId,
          level: r.level,
          dueAt: resolveDueDateByLevel(r.level),
        })),
      });

      return tx.nomination.findUnique({
        where: { id },
        include: { reviews: true },
      });
    });

    await logAudit(req.user.id, "SUBMIT_NOMINATION", `Submitted nomination ${id}`);
    if (result?.reviews?.length) {
      await createNotification(result.reviews[0].reviewerId, `Có hồ sơ mới cần duyệt: ${result.title}`);
    }

    return res.json(result);
  } catch (error) {
    return next(error);
  }
});

router.post("/:id/reopen", authenticate, async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const nomination = await prisma.nomination.findUnique({
      where: { id },
      include: {
        items: true,
        evidences: true,
      },
    });

    if (!nomination) {
      return res.status(404).json({ message: "Khong tim thay ho so" });
    }

    if (nomination.applicantId !== req.user.id) {
      return res.status(403).json({ message: "Khong co quyen mo lai ho so nay" });
    }

    if (nomination.status !== "REJECTED") {
      return res.status(400).json({ message: "Chi ho so bi tu choi moi duoc mo lai" });
    }

    const reopened = await prisma.$transaction(async (tx) => {
      const recreated = await tx.nomination.create({
        data: {
          title: nomination.title,
          periodYear: nomination.periodYear,
          academicYearId: nomination.academicYearId,
          applicantId: nomination.applicantId,
          totalSelfPoint: nomination.totalSelfPoint,
          status: "DRAFT",
          items: {
            create: nomination.items.map((item) => ({
              criteriaId: item.criteriaId,
              selfPoint: item.selfPoint,
              evidence: item.evidence,
            })),
          },
        },
      });

      if (nomination.evidences.length) {
        await tx.evidence.createMany({
          data: nomination.evidences.map((ev) => ({
            nominationId: recreated.id,
            fileUrl: ev.fileUrl,
            description: ev.description,
            scanStatus: ev.scanStatus,
            fileHash: ev.fileHash,
            scanDetail: ev.scanDetail,
            scannedAt: ev.scannedAt,
          })),
        });
      }

      return recreated;
    });

    await logAudit(req.user.id, "REOPEN_NOMINATION", `Created nomination ${reopened.id} from rejected nomination ${id}`);
    return res.json(reopened);
  } catch (error) {
    return next(error);
  }
});

router.post("/upload-evidence", authenticate, upload.single("file"), async (req, res, next) => {
  try {
    const secured = await secureUploadedFile(req.file);
    return res.status(201).json(secured);
  } catch (error) {
    return next(error);
  }
});

router.post("/:id/evidences", authenticate, upload.single("file"), async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const nomination = await prisma.nomination.findUnique({ where: { id } });
    if (!nomination) {
      return res.status(404).json({ message: "Khong tim thay ho so" });
    }

    if (nomination.applicantId !== req.user.id) {
      return res.status(403).json({ message: "Khong co quyen cap nhat minh chung" });
    }

    const secured = await secureUploadedFile(req.file);

    const evidence = await prisma.evidence.create({
      data: {
        nominationId: id,
        fileUrl: secured.fileUrl,
        description: req.body.description || "",
        scanStatus: secured.scanStatus,
        fileHash: secured.fileHash,
        scanDetail: secured.scanDetail,
        scannedAt: secured.scannedAt,
      },
    });

    await logAudit(req.user.id, "UPLOAD_EVIDENCE", `Uploaded evidence for nomination ${id}`);
    return res.status(201).json(evidence);
  } catch (error) {
    return next(error);
  }
});

router.get("/evidences/:evidenceId/download", authenticate, async (req, res, next) => {
  try {
    const evidenceId = Number(req.params.evidenceId);
    const evidence = await prisma.evidence.findUnique({
      where: { id: evidenceId },
      include: {
        nomination: {
          select: {
            applicantId: true,
          },
        },
      },
    });

    if (!evidence) {
      return res.status(404).json({ message: "Khong tim thay tep minh chung" });
    }

    const canReview = ["ADMIN", "CANBO", "HOIDONG"].includes(req.user.role);
    const isOwner = evidence.nomination?.applicantId === req.user.id;
    if (!canReview && !isOwner) {
      return res.status(403).json({ message: "Khong co quyen tai tep nay" });
    }

    if (evidence.scanStatus !== "CLEAN") {
      return res.status(423).json({ message: "Tep chua dat trang thai an toan de tai xuong" });
    }

    const relativeFilePath = evidence.fileUrl.replace(/^\/+/, "");
    const filePath = path.join(__dirname, "..", "..", relativeFilePath);
    await fs.promises.access(filePath, fs.constants.F_OK);

    res.setHeader("X-Content-Type-Options", "nosniff");
    await logAudit(req.user.id, "DOWNLOAD_EVIDENCE", `Downloaded evidence ${evidenceId}`);
    return res.download(filePath);
  } catch (error) {
    return next(error);
  }
});

router.delete("/:id/evidences/:evidenceId", authenticate, async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const evidenceId = Number(req.params.evidenceId);

    const nomination = await prisma.nomination.findUnique({ where: { id } });
    if (!nomination) {
      return res.status(404).json({ message: "Khong tim thay ho so" });
    }

    if (nomination.applicantId !== req.user.id) {
      return res.status(403).json({ message: "Khong co quyen cap nhat minh chung" });
    }

    if (nomination.status === "APPROVED") {
      return res.status(400).json({ message: "Ho so da duoc duyet, khong the xoa minh chung" });
    }

    const evidence = await prisma.evidence.findFirst({
      where: {
        id: evidenceId,
        nominationId: id,
      },
    });

    if (!evidence) {
      return res.status(404).json({ message: "Khong tim thay tep minh chung" });
    }

    await prisma.evidence.delete({ where: { id: evidenceId } });

    if (evidence.fileUrl?.startsWith("/uploads/evidences/")) {
      const relativeFilePath = evidence.fileUrl.replace(/^\/+/, "");
      const filePath = path.join(__dirname, "..", "..", relativeFilePath);
      fs.promises.unlink(filePath).catch(() => null);
    }

    await logAudit(req.user.id, "DELETE_EVIDENCE", `Deleted evidence ${evidenceId} for nomination ${id}`);

    return res.json({ message: "Da xoa tep minh chung" });
  } catch (error) {
    return next(error);
  }
});

module.exports = router;
