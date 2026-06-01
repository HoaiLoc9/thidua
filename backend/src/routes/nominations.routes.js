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

    const validationError = new Error("Chỉ được nộp minh chứng dạng PDF, DOCX, XLSX, PNG/JPG hoặc ZIP");
    validationError.status = 400;
    cb(validationError);
  },
});

const itemSchema = z.object({
  criteriaId: z.number().int().positive(),
  selfPoint: z.number().int().min(0),
  evidence: z.string().optional(),
});

const awardEvidenceSchema = z.object({
  awardCriterionId: z.number().int().positive(),
  fileUrl: z.string().min(1),
  fileHash: z.string().nullable().optional(),
  scanStatus: z.enum(["PENDING_SCAN", "CLEAN", "INFECTED", "SCAN_ERROR"]).optional(),
  scanDetail: z.string().nullable().optional(),
  scannedAt: z.string().datetime().nullable().optional(),
});

const memberSchema = z.object({
  fullName: z.string().trim().min(2),
  email: z.string().trim().email().optional().or(z.literal("")),
  memberRole: z.enum(["STUDENT", "LECTURER", "ADVISOR", "CO_AUTHOR", "LEADER"]),
  contribution: z.string().trim().optional().or(z.literal("")),
  isLeader: z.boolean().optional(),
});

const nominationSchema = z.object({
  title: z.string().min(3),
  periodYear: z.number().int().min(2020),
  awardTypeId: z.number().int().positive().optional(),
  submissionType: z.enum(["INDIVIDUAL", "GROUP"]).optional().default("INDIVIDUAL"),
  groupName: z.string().trim().optional().or(z.literal("")),
  members: z.array(memberSchema).optional().default([]),
  items: z.array(itemSchema).optional().default([]),
  awardCriteriaEvidences: z.array(awardEvidenceSchema).optional().default([]),
});

async function secureUploadedFile(file) {
  if (!file) {
    const error = new Error("Vui lòng chọn tệp minh chứng");
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
    const error = new Error("Tệp tải lên bị phát hiện mã độc và đã bị từ chối");
    error.status = 400;
    throw error;
  }

  if (scanResult.status === "SCAN_ERROR" && !allowPendingOnScanError) {
    await fs.promises.unlink(file.path).catch(() => null);
    const error = new Error("Không thể quét mã độc lúc này. Vui lòng thử lại sau");
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

async function normalizeMembersForPayload(payload, applicant) {
  if (payload.submissionType !== "GROUP") {
    return [];
  }

  const membersByEmail = new Map();
  const normalized = [];

  for (const member of payload.members || []) {
    const email = (member.email || "").trim().toLowerCase();
    const key = email || `${member.fullName.trim().toLowerCase()}-${normalized.length}`;
    if (membersByEmail.has(key)) {
      continue;
    }

    membersByEmail.set(key, true);
    normalized.push({
      fullName: member.fullName.trim(),
      email: email || null,
      memberRole: member.isLeader ? "LEADER" : member.memberRole,
      contribution: member.contribution?.trim() || null,
      isLeader: Boolean(member.isLeader || member.memberRole === "LEADER"),
    });
  }

  const applicantEmail = applicant.email?.trim().toLowerCase();
  const hasApplicant = normalized.some((member) => member.email && member.email === applicantEmail);
  if (!hasApplicant) {
    normalized.unshift({
      fullName: applicant.fullName,
      email: applicant.email,
      memberRole: "LEADER",
      contribution: "Trưởng nhóm phụ trách nộp hồ sơ",
      isLeader: true,
    });
  }

  if (!normalized.some((member) => member.isLeader)) {
    normalized[0].isLeader = true;
    normalized[0].memberRole = "LEADER";
  }

  const emailList = normalized.map((member) => member.email).filter(Boolean);
  const users = emailList.length
    ? await prisma.user.findMany({
        where: { email: { in: emailList } },
        select: { id: true, email: true },
      })
    : [];
  const userIdByEmail = new Map(users.map((user) => [user.email.toLowerCase(), user.id]));

  return normalized.map((member) => ({
    ...member,
    userId: member.email ? userIdByEmail.get(member.email) || null : null,
  }));
}

async function validateAwardPayload(payload) {
  if (!payload.awardTypeId) {
    return null;
  }

  const awardType = await prisma.awardType.findUnique({
    where: { id: payload.awardTypeId },
    include: { criteria: true },
  });

  if (!awardType || awardType.isActive === false) {
    const error = new Error("Danh hiệu/khen thưởng không hợp lệ hoặc đã ngừng áp dụng");
    error.status = 400;
    throw error;
  }

  const allowedCriterionIds = new Set(awardType.criteria.map((criterion) => criterion.id));
  const invalidEvidence = (payload.awardCriteriaEvidences || []).find(
    (item) => !allowedCriterionIds.has(item.awardCriterionId)
  );

  if (invalidEvidence) {
    const error = new Error("Minh chứng không thuộc tiêu chí của danh hiệu đã chọn");
    error.status = 400;
    throw error;
  }

  const evidenceCriterionIds = new Set((payload.awardCriteriaEvidences || []).map((item) => item.awardCriterionId));
  const missingCriterion = awardType.criteria.find((criterion) => !evidenceCriterionIds.has(criterion.id));
  if (missingCriterion) {
    const error = new Error(`Vui lòng nộp minh chứng cho tiêu chí: ${missingCriterion.title}`);
    error.status = 400;
    throw error;
  }

  return awardType;
}

function buildEvidenceRowsFromPayload(nominationId, items, awardCriteriaEvidences) {
  const itemEvidenceRows = (items || [])
    .filter((item) => item.evidence && item.evidence.trim())
    .map((item) => ({
      nominationId,
      fileUrl: item.evidence.trim(),
      description: `Minh chứng tiêu chí ${item.criteriaId}`,
      scanStatus: "CLEAN",
    }));

  const awardEvidenceRows = (awardCriteriaEvidences || [])
    .filter((item) => item.fileUrl && item.fileUrl.trim())
    .map((item) => ({
      nominationId,
      awardCriterionId: item.awardCriterionId,
      fileUrl: item.fileUrl.trim(),
      description: `Minh chứng danh hiệu - tiêu chí ${item.awardCriterionId}`,
      scanStatus: item.scanStatus || "CLEAN",
      fileHash: item.fileHash || null,
      scanDetail: item.scanDetail || null,
      scannedAt: item.scannedAt ? new Date(item.scannedAt) : null,
    }));

  return [...itemEvidenceRows, ...awardEvidenceRows];
}

router.get("/", authenticate, async (req, res, next) => {
  try {
    const archiveFilter =
      req.user.role === "ADMIN" && req.query.archived === "only"
        ? { isArchived: true }
        : req.user.role === "ADMIN" && req.query.archived === "all"
          ? {}
          : { isArchived: false };

    const where = ["GIANGVIEN", "SINHVIEN"].includes(req.user.role)
      ? {
          ...archiveFilter,
          OR: [
            { applicantId: req.user.id },
            { members: { some: { userId: req.user.id } } },
            { members: { some: { email: req.user.email } } },
          ],
        }
      : archiveFilter;

    const data = await prisma.nomination.findMany({
      where,
      include: {
        applicant: {
          select: { id: true, fullName: true, email: true, department: true, role: true },
        },
        archivedBy: {
          select: { id: true, fullName: true, email: true },
        },
        awardType: {
          include: {
            criteria: {
              orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
            },
          },
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
          include: {
            awardCriterion: true,
          },
          orderBy: { uploadedAt: "desc" },
        },
        members: {
          include: {
            user: {
              select: { id: true, fullName: true, email: true, role: true },
            },
          },
          orderBy: [{ isLeader: "desc" }, { id: "asc" }],
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
      return res.status(403).json({ message: "Chỉ giảng viên/sinh viên mới tạo hồ sơ" });
    }

    const payload = nominationSchema.parse(req.body);
    const items = normalizeItemsForRole(payload.items, req.user.role);
    await validateAwardPayload(payload);

    if (!payload.awardTypeId && !items.length) {
      return res.status(400).json({ message: "Vui lòng chọn danh hiệu hoặc tiêu chí cho hồ sơ" });
    }

    const members = await normalizeMembersForPayload(payload, req.user);
    const totalSelfPoint = await calculateTotal(items);

    const created = await prisma.$transaction(async (tx) => {
      const nomination = await tx.nomination.create({
        data: {
          title: payload.title,
          periodYear: payload.periodYear,
          awardTypeId: payload.awardTypeId || null,
          submissionType: payload.submissionType,
          groupName: payload.submissionType === "GROUP" ? payload.groupName || null : null,
          applicantId: req.user.id,
          totalSelfPoint,
          items: items.length ? { create: items } : undefined,
          members: members.length ? { create: members } : undefined,
        },
        include: {
          items: true,
          members: true,
        },
      });

      const evidenceRows = buildEvidenceRowsFromPayload(nomination.id, items, payload.awardCriteriaEvidences);

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
      return res.status(404).json({ message: "Không tìm thấy hồ sơ" });
    }

    if (existed.applicantId !== req.user.id && ["GIANGVIEN", "SINHVIEN"].includes(req.user.role)) {
      return res.status(403).json({ message: "Không có quyền sửa hồ sơ này" });
    }

    if (existed.status !== "DRAFT") {
      return res.status(400).json({ message: "Chỉ hồ sơ nháp mới được cập nhật" });
    }

    const items = normalizeItemsForRole(payload.items, req.user.role);
    await validateAwardPayload(payload);

    if (!payload.awardTypeId && !items.length) {
      return res.status(400).json({ message: "Vui lòng chọn danh hiệu hoặc tiêu chí cho hồ sơ" });
    }

    const members = await normalizeMembersForPayload(payload, req.user);
    const totalSelfPoint = await calculateTotal(items);

    const updated = await prisma.$transaction(async (tx) => {
      const nomination = await tx.nomination.update({
        where: { id },
        data: {
          title: payload.title,
          periodYear: payload.periodYear,
          awardTypeId: payload.awardTypeId || null,
          submissionType: payload.submissionType,
          groupName: payload.submissionType === "GROUP" ? payload.groupName || null : null,
          totalSelfPoint,
          items: {
            deleteMany: {},
            ...(items.length ? { create: items } : {}),
          },
          members: {
            deleteMany: {},
            ...(members.length ? { create: members } : {}),
          },
        },
        include: {
          items: true,
          members: true,
        },
      });

      await tx.evidence.deleteMany({ where: { nominationId: id } });
      const evidenceRows = buildEvidenceRowsFromPayload(id, items, payload.awardCriteriaEvidences);

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
      return res.status(404).json({ message: "Không tìm thấy hồ sơ" });
    }

    if (nomination.applicantId !== req.user.id) {
      return res.status(403).json({ message: "Không có quyền nộp hồ sơ này" });
    }

    if (nomination.status !== "DRAFT") {
      return res.status(400).json({ message: "Hồ sơ đã được nộp" });
    }

    const khoaReviewer = await prisma.user.findFirst({
      where: { email: "canbo1@iuh.edu.vn", role: "CANBO" },
      orderBy: { id: "asc" },
    });
    const schoolReviewer = await prisma.user.findFirst({
      where: { role: "HOIDONG" },
      orderBy: { id: "asc" },
    });
    const fallbackAdmin = await prisma.user.findFirst({
      where: { role: "ADMIN" },
      orderBy: { id: "asc" },
    });

    if (!khoaReviewer || (!schoolReviewer && !fallbackAdmin)) {
      return res.status(400).json({
        message: "Cần có ít nhất 1 cán bộ cấp khoa và 1 hội đồng/admin để thực hiện quy trình duyệt",
      });
    }

    const reviewers = [
      { reviewerId: khoaReviewer.id, level: "KHOA" },
      { reviewerId: schoolReviewer ? schoolReviewer.id : fallbackAdmin.id, level: "TRUONG" },
    ];

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
        members: true,
      },
    });

    if (!nomination) {
      return res.status(404).json({ message: "Không tìm thấy hồ sơ" });
    }

    if (nomination.applicantId !== req.user.id) {
      return res.status(403).json({ message: "Không có quyền mở lại hồ sơ này" });
    }

    if (nomination.status !== "REJECTED") {
      return res.status(400).json({ message: "Chỉ hồ sơ bị từ chối mới được mở lại" });
    }

    const reopened = await prisma.$transaction(async (tx) => {
      const recreated = await tx.nomination.create({
        data: {
          title: nomination.title,
          periodYear: nomination.periodYear,
          academicYearId: nomination.academicYearId,
          awardTypeId: nomination.awardTypeId,
          submissionType: nomination.submissionType,
          groupName: nomination.groupName,
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
          members: nomination.members.length
            ? {
                create: nomination.members.map((member) => ({
                  userId: member.userId,
                  fullName: member.fullName,
                  email: member.email,
                  memberRole: member.memberRole,
                  contribution: member.contribution,
                  isLeader: member.isLeader,
                })),
              }
            : undefined,
        },
      });

      if (nomination.evidences.length) {
        await tx.evidence.createMany({
          data: nomination.evidences.map((ev) => ({
            nominationId: recreated.id,
            awardCriterionId: ev.awardCriterionId,
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

router.patch("/:id/archive", authenticate, async (req, res, next) => {
  try {
    if (req.user.role !== "ADMIN") {
      return res.status(403).json({ message: "Chỉ admin mới được lưu trữ hồ sơ" });
    }

    const id = Number(req.params.id);
    const nomination = await prisma.nomination.findUnique({
      where: { id },
      include: { reviews: true },
    });

    if (!nomination) {
      return res.status(404).json({ message: "Không tìm thấy hồ sơ" });
    }

    const truongReview = nomination.reviews.find((review) => review.level === "TRUONG");
    const finalizedByCouncil =
      ["APPROVED", "REJECTED"].includes(nomination.status) &&
      truongReview &&
      truongReview.decision !== "PENDING";

    if (!finalizedByCouncil) {
      return res.status(400).json({ message: "Chỉ được lưu trữ hồ sơ đã được hội đồng chốt kết quả" });
    }

    const updated = await prisma.nomination.update({
      where: { id },
      data: {
        isArchived: true,
        archivedAt: new Date(),
        archivedById: req.user.id,
      },
    });

    await logAudit(req.user.id, "ARCHIVE_NOMINATION", `Archived nomination ${id}`);
    return res.json(updated);
  } catch (error) {
    return next(error);
  }
});

router.patch("/:id/soft-delete-rejected", authenticate, async (req, res, next) => {
  try {
    if (req.user.role !== "ADMIN") {
      return res.status(403).json({ message: "Chỉ admin mới được xóa mềm hồ sơ" });
    }

    const id = Number(req.params.id);
    const nomination = await prisma.nomination.findUnique({ where: { id } });

    if (!nomination) {
      return res.status(404).json({ message: "Không tìm thấy hồ sơ" });
    }

    if (nomination.status !== "REJECTED") {
      return res.status(400).json({ message: "Chỉ được xóa mềm hồ sơ bị từ chối" });
    }

    const updated = await prisma.nomination.update({
      where: { id },
      data: {
        isArchived: true,
        archivedAt: new Date(),
        archivedById: req.user.id,
      },
    });

    await logAudit(req.user.id, "SOFT_DELETE_REJECTED_NOMINATION", `Soft deleted rejected nomination ${id}`);
    return res.json(updated);
  } catch (error) {
    return next(error);
  }
});

router.patch("/:id/restore", authenticate, async (req, res, next) => {
  try {
    if (req.user.role !== "ADMIN") {
      return res.status(403).json({ message: "Chỉ admin mới được khôi phục hồ sơ" });
    }

    const id = Number(req.params.id);
    const updated = await prisma.nomination.update({
      where: { id },
      data: {
        isArchived: false,
        archivedAt: null,
        archivedById: null,
      },
    });

    await logAudit(req.user.id, "RESTORE_NOMINATION", `Restored nomination ${id}`);
    return res.json(updated);
  } catch (error) {
    return next(error);
  }
});

router.post("/:id/evidences", authenticate, upload.single("file"), async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const nomination = await prisma.nomination.findUnique({ where: { id } });
    if (!nomination) {
      return res.status(404).json({ message: "Không tìm thấy hồ sơ" });
    }

    if (nomination.applicantId !== req.user.id) {
      return res.status(403).json({ message: "Không có quyền cập nhật minh chứng" });
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
      return res.status(404).json({ message: "Không tìm thấy tệp minh chứng" });
    }

    const canReview = ["ADMIN", "CANBO", "HOIDONG"].includes(req.user.role);
    const isOwner = evidence.nomination?.applicantId === req.user.id;
    if (!canReview && !isOwner) {
      return res.status(403).json({ message: "Không có quyền tải tệp này" });
    }

    if (evidence.scanStatus !== "CLEAN") {
      return res.status(423).json({ message: "Tệp chưa đạt trạng thái an toàn để tải xuống" });
    }

    const relativeFilePath = evidence.fileUrl.replace(/^\/+/, "");
    const filePath = path.resolve(__dirname, "..", "..", relativeFilePath);
    const safeEvidenceDir = path.resolve(evidenceDir);
    if (!filePath.startsWith(`${safeEvidenceDir}${path.sep}`)) {
      return res.status(400).json({ message: "Đường dẫn tệp minh chứng không hợp lệ" });
    }

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
      return res.status(404).json({ message: "Không tìm thấy hồ sơ" });
    }

    if (nomination.applicantId !== req.user.id) {
      return res.status(403).json({ message: "Không có quyền cập nhật minh chứng" });
    }

    if (nomination.status === "APPROVED") {
      return res.status(400).json({ message: "Hồ sơ đã được duyệt, không thể xóa minh chứng" });
    }

    const evidence = await prisma.evidence.findFirst({
      where: {
        id: evidenceId,
        nominationId: id,
      },
    });

    if (!evidence) {
      return res.status(404).json({ message: "Không tìm thấy tệp minh chứng" });
    }

    await prisma.evidence.delete({ where: { id: evidenceId } });

    if (evidence.fileUrl?.startsWith("/uploads/evidences/")) {
      const relativeFilePath = evidence.fileUrl.replace(/^\/+/, "");
      const filePath = path.join(__dirname, "..", "..", relativeFilePath);
      fs.promises.unlink(filePath).catch(() => null);
    }

    await logAudit(req.user.id, "DELETE_EVIDENCE", `Deleted evidence ${evidenceId} for nomination ${id}`);

    return res.json({ message: "Đã xóa tệp minh chứng" });
  } catch (error) {
    return next(error);
  }
});

module.exports = router;
