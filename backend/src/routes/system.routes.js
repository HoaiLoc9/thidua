const express = require("express");
const { spawn } = require("child_process");
const fs = require("fs");
const path = require("path");
const { z } = require("zod");
const { authenticate, authorize } = require("../middlewares/auth");
const prisma = require("../lib/prisma");
const { scanPendingEvidenceBatch } = require("../jobs/evidenceScan.job");

const router = express.Router();

const workflowConfigPath = path.join(__dirname, "..", "..", "data", "workflow-config.json");
const backupDir = path.join(__dirname, "..", "..", "backups");

function resolvePgDumpPath() {
  const configured = process.env.PG_DUMP_PATH;
  const candidates = [
    configured,
    "C:\\Program Files\\PostgreSQL\\18\\bin\\pg_dump.exe",
    "C:\\Program Files\\PostgreSQL\\17\\bin\\pg_dump.exe",
    "C:\\Program Files\\PostgreSQL\\16\\bin\\pg_dump.exe",
  ].filter(Boolean);

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }

  return null;
}

function readWorkflowConfig() {
  const raw = fs.readFileSync(workflowConfigPath, "utf8");
  return JSON.parse(raw);
}

router.get("/workflow-config", authenticate, authorize("ADMIN"), (req, res, next) => {
  try {
    return res.json(readWorkflowConfig());
  } catch (error) {
    return next(error);
  }
});

router.put("/workflow-config", authenticate, authorize("ADMIN"), (req, res, next) => {
  try {
    const schema = z.object({
      stages: z.array(z.enum(["KHOA", "TRUONG"])).min(1),
      allowSkip: z.boolean(),
    });

    const data = schema.parse(req.body);
    const nextValue = {
      ...data,
      updatedAt: new Date().toISOString(),
    };

    fs.writeFileSync(workflowConfigPath, JSON.stringify(nextValue, null, 2));
    return res.json(nextValue);
  } catch (error) {
    return next(error);
  }
});

router.post("/backup", authenticate, authorize("ADMIN"), (req, res, next) => {
  try {
    const pgDumpPath = resolvePgDumpPath();
    if (!pgDumpPath) {
      return res.status(500).json({
        message: "Không tìm thấy pg_dump để sao lưu PostgreSQL",
      });
    }

    if (!process.env.DATABASE_URL) {
      return res.status(500).json({ message: "Chưa cấu hình DATABASE_URL" });
    }

    fs.mkdirSync(backupDir, { recursive: true });
    const filename = `postgres-backup-${Date.now()}.sql`;
    const backupPath = path.join(backupDir, filename);

    const child = spawn(
      pgDumpPath,
      [
        "--dbname",
        process.env.DATABASE_URL,
        "--file",
        backupPath,
        "--format=plain",
        "--no-owner",
        "--no-privileges",
      ],
      { windowsHide: true }
    );

    let stderr = "";
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });

    child.on("error", (error) => {
      return next(error);
    });

    child.on("close", (code) => {
      if (code !== 0) {
        return next(new Error(stderr.trim() || `pg_dump exited with code ${code}`));
      }

      return res.status(201).json({
        message: "Sao luu thanh cong",
        filename,
      });
    });
  } catch (error) {
    return next(error);
  }
});

router.get("/ops-summary", authenticate, authorize("ADMIN", "CANBO", "HOIDONG"), async (req, res, next) => {
  try {
    const now = new Date();
    const [
      pendingReviews,
      overdueReviews,
      evidencePending,
      evidenceInfected,
      evidenceScanError,
      nominationsSubmitted,
      nominationsRejected,
    ] = await Promise.all([
      prisma.reviewStep.count({ where: { decision: "PENDING" } }),
      prisma.reviewStep.count({ where: { decision: "PENDING", dueAt: { lt: now } } }),
      prisma.evidence.count({ where: { scanStatus: "PENDING_SCAN" } }),
      prisma.evidence.count({ where: { scanStatus: "INFECTED" } }),
      prisma.evidence.count({ where: { scanStatus: "SCAN_ERROR" } }),
      prisma.nomination.count({ where: { status: "SUBMITTED" } }),
      prisma.nomination.count({ where: { status: "REJECTED" } }),
    ]);

    return res.json({
      pendingReviews,
      overdueReviews,
      evidencePending,
      evidenceInfected,
      evidenceScanError,
      nominationsSubmitted,
      nominationsRejected,
    });
  } catch (error) {
    return next(error);
  }
});

router.get("/dashboard", authenticate, async (req, res, next) => {
  try {
    const role = req.user.role;
    const now = new Date();
    const isApplicant = ["GIANGVIEN", "SINHVIEN"].includes(role);
    const nominationWhere = isApplicant
      ? {
          isArchived: false,
          OR: [
            { applicantId: req.user.id },
            { members: { some: { userId: req.user.id } } },
            { members: { some: { email: req.user.email } } },
          ],
        }
      : { isArchived: false };

    const myPendingReviewWhere = role === "ADMIN"
      ? { decision: "PENDING", nomination: { isArchived: false } }
      : role === "HOIDONG"
        ? { decision: "PENDING", level: "TRUONG", nomination: { isArchived: false } }
        : ["CANBO"].includes(role)
          ? { decision: "PENDING", reviewerId: req.user.id, nomination: { isArchived: false } }
          : null;

    const [
      statusGroups,
      recentNominations,
      pendingTasks,
      overdueTasks,
      councilReady,
      evidencePending,
      evidenceInfected,
      evidenceScanError,
      archivedCount,
      recentNotifications,
      recentAuditLogs,
      pendingEvidenceRows,
    ] = await Promise.all([
      prisma.nomination.groupBy({
        by: ["status"],
        where: nominationWhere,
        _count: { status: true },
      }),
      prisma.nomination.findMany({
        where: nominationWhere,
        select: {
          id: true,
          title: true,
          status: true,
          totalSelfPoint: true,
          updatedAt: true,
          awardType: { select: { name: true } },
          applicant: { select: { fullName: true, department: true } },
          reviews: {
            select: {
              id: true,
              level: true,
              decision: true,
              reviewerId: true,
            },
            orderBy: { id: "asc" },
          },
        },
        orderBy: { updatedAt: "desc" },
        take: 8,
      }),
      myPendingReviewWhere
        ? prisma.reviewStep.count({ where: myPendingReviewWhere })
        : prisma.nomination.count({
            where: {
              AND: [
                nominationWhere,
                { OR: [{ status: "DRAFT" }, { status: "REJECTED" }] },
              ],
            },
          }),
      myPendingReviewWhere
        ? prisma.reviewStep.count({ where: { ...myPendingReviewWhere, dueAt: { lt: now } } })
        : Promise.resolve(0),
      role === "HOIDONG" || role === "ADMIN"
        ? prisma.reviewStep.count({
            where: {
              level: "TRUONG",
              decision: "PENDING",
              nomination: { isArchived: false, status: "SUBMITTED" },
            },
          })
        : Promise.resolve(0),
      ["ADMIN", "CANBO", "HOIDONG"].includes(role)
        ? prisma.evidence.count({ where: { scanStatus: "PENDING_SCAN", nomination: { isArchived: false } } })
        : Promise.resolve(0),
      ["ADMIN", "CANBO", "HOIDONG"].includes(role)
        ? prisma.evidence.count({ where: { scanStatus: "INFECTED", nomination: { isArchived: false } } })
        : Promise.resolve(0),
      ["ADMIN", "CANBO", "HOIDONG"].includes(role)
        ? prisma.evidence.count({ where: { scanStatus: "SCAN_ERROR", nomination: { isArchived: false } } })
        : Promise.resolve(0),
      role === "ADMIN" ? prisma.nomination.count({ where: { isArchived: true } }) : Promise.resolve(0),
      prisma.notification.findMany({
        where: { userId: req.user.id },
        orderBy: { createdAt: "desc" },
        take: 6,
      }),
      role === "ADMIN"
        ? prisma.auditLog.findMany({
            include: { user: { select: { fullName: true, email: true, role: true } } },
            orderBy: { timestamp: "desc" },
            take: 8,
          })
        : Promise.resolve([]),
      role === "ADMIN"
        ? prisma.evidence.findMany({
            where: { scanStatus: "PENDING_SCAN" },
            include: {
              nomination: {
                select: {
                  id: true,
                  title: true,
                  applicant: { select: { fullName: true } },
                },
              },
            },
            orderBy: { uploadedAt: "asc" },
            take: 8,
          })
        : Promise.resolve([]),
    ]);

    const counts = Object.fromEntries(statusGroups.map((item) => [item.status, item._count.status]));
    const totalNominations = Object.values(counts).reduce((sum, value) => sum + value, 0);
    const todoItems = [];

    if (isApplicant) {
      if (counts.DRAFT) todoItems.push({ label: "Hoàn thiện hồ sơ nháp", count: counts.DRAFT, path: "/nominations?status=DRAFT" });
      if (counts.REJECTED) todoItems.push({ label: "Bổ sung hồ sơ bị từ chối", count: counts.REJECTED, path: "/nominations?status=REJECTED" });
      if (counts.SUBMITTED) todoItems.push({ label: "Theo dõi hồ sơ đang chờ duyệt", count: counts.SUBMITTED, path: "/nominations?status=SUBMITTED" });
    } else {
      if (pendingTasks) todoItems.push({ label: role === "HOIDONG" ? "Hồ sơ cấp trường cần biểu quyết" : "Phiên duyệt đang chờ xử lý", count: pendingTasks, path: "/reviews" });
      if (overdueTasks) todoItems.push({ label: "Phiên duyệt quá hạn", count: overdueTasks, path: "/reviews" });
      if (councilReady) todoItems.push({ label: "Hồ sơ cấp trường cần chốt", count: councilReady, path: "/reviews" });
      if (role === "ADMIN" && evidencePending) todoItems.push({ label: "File minh chứng chờ quét", count: evidencePending, path: "/" });
    }

    return res.json({
      role,
      user: {
        fullName: req.user.fullName,
        email: req.user.email,
        department: req.user.department,
      },
      kpis: {
        totalNominations,
        draft: counts.DRAFT || 0,
        submitted: counts.SUBMITTED || 0,
        approved: counts.APPROVED || 0,
        rejected: counts.REJECTED || 0,
        pendingTasks,
        overdueTasks,
        councilReady,
        evidencePending,
        evidenceInfected,
        evidenceScanError,
        archivedCount,
      },
      statusChart: ["DRAFT", "SUBMITTED", "APPROVED", "REJECTED"].map((status) => ({
        status,
        total: counts[status] || 0,
      })),
      todoItems,
      recentNominations,
      recentNotifications,
      adminSecurity: {
        evidencePending,
        evidenceInfected,
        evidenceScanError,
        pendingEvidenceRows,
      },
      recentAuditLogs,
    });
  } catch (error) {
    return next(error);
  }
});

router.post("/scan-pending-evidence", authenticate, authorize("ADMIN"), async (req, res, next) => {
  try {
    const result = await scanPendingEvidenceBatch(50);
    return res.json({ message: "Đã kích hoạt quét lại tệp chờ", ...result });
  } catch (error) {
    return next(error);
  }
});

router.get("/pending-evidence", authenticate, authorize("ADMIN"), async (req, res, next) => {
  try {
    const rows = await prisma.evidence.findMany({
      where: { scanStatus: "PENDING_SCAN" },
      include: {
        nomination: {
          select: {
            id: true,
            title: true,
            applicant: { select: { id: true, fullName: true } },
          },
        },
      },
      orderBy: { uploadedAt: "asc" },
      take: 200,
    });
    return res.json(rows);
  } catch (error) {
    return next(error);
  }
});

module.exports = router;
