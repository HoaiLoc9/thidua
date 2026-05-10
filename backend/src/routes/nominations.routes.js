const express = require("express");
const fs = require("fs");
const path = require("path");
const multer = require("multer");
const { z } = require("zod");
const prisma = require("../lib/prisma");
const { authenticate } = require("../middlewares/auth");
const { logAudit } = require("../utils/audit");
const { createNotification } = require("../utils/notify");

const router = express.Router();

const evidenceDir = path.join(__dirname, "..", "..", "uploads", "evidences");
fs.mkdirSync(evidenceDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, evidenceDir),
  filename: (req, file, cb) => {
    const safeName = file.originalname.replace(/[^a-zA-Z0-9.-]/g, "_");
    cb(null, `${Date.now()}-${safeName}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
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

async function calculateTotal(items) {
  return items.reduce((sum, item) => sum + item.selfPoint, 0);
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
            criteria: true,
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
      orderBy: { createdAt: "desc" },
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
    const totalSelfPoint = await calculateTotal(payload.items);

    const created = await prisma.$transaction(async (tx) => {
      const nomination = await tx.nomination.create({
        data: {
          title: payload.title,
          periodYear: payload.periodYear,
          applicantId: req.user.id,
          totalSelfPoint,
          items: {
            create: payload.items,
          },
        },
        include: {
          items: true,
        },
      });

      const evidenceRows = payload.items
        .filter((item) => item.evidence && item.evidence.trim())
        .map((item) => ({
          nominationId: nomination.id,
          fileUrl: item.evidence.trim(),
          description: `Minh chung tieu chi ${item.criteriaId}`,
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

    const totalSelfPoint = await calculateTotal(payload.items);

    const updated = await prisma.$transaction(async (tx) => {
      const nomination = await tx.nomination.update({
        where: { id },
        data: {
          title: payload.title,
          periodYear: payload.periodYear,
          totalSelfPoint,
          items: {
            deleteMany: {},
            create: payload.items,
          },
        },
        include: {
          items: true,
        },
      });

      await tx.evidence.deleteMany({ where: { nominationId: id } });
      const evidenceRows = payload.items
        .filter((item) => item.evidence && item.evidence.trim())
        .map((item) => ({
          nominationId: id,
          fileUrl: item.evidence.trim(),
          description: `Minh chung tieu chi ${item.criteriaId}`,
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
    const nomination = await prisma.nomination.findUnique({ where: { id } });

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
      await tx.reviewStep.deleteMany({ where: { nominationId: id } });
      await tx.approvalResult.deleteMany({ where: { nominationId: id } });
      return tx.nomination.update({
        where: { id },
        data: { status: "DRAFT" },
      });
    });

    await logAudit(req.user.id, "REOPEN_NOMINATION", `Reopened nomination ${id}`);
    return res.json(reopened);
  } catch (error) {
    return next(error);
  }
});

router.post("/upload-evidence", authenticate, upload.single("file"), async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: "Vui long chon tep minh chung" });
    }

    const fileUrl = `/uploads/evidences/${req.file.filename}`;
    return res.status(201).json({ fileUrl });
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

    if (!req.file) {
      return res.status(400).json({ message: "Vui long chon tep minh chung" });
    }

    const evidence = await prisma.evidence.create({
      data: {
        nominationId: id,
        fileUrl: `/uploads/evidences/${req.file.filename}`,
        description: req.body.description || "",
      },
    });

    await logAudit(req.user.id, "UPLOAD_EVIDENCE", `Uploaded evidence for nomination ${id}`);
    return res.status(201).json(evidence);
  } catch (error) {
    return next(error);
  }
});

module.exports = router;
