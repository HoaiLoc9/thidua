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
      stages: z.array(z.enum(["DONVI", "KHOA", "TRUONG"])).min(1),
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
        message: "Khong tim thay pg_dump de sao luu PostgreSQL",
      });
    }

    if (!process.env.DATABASE_URL) {
      return res.status(500).json({ message: "Chua cau hinh DATABASE_URL" });
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

router.post("/scan-pending-evidence", authenticate, authorize("ADMIN"), async (req, res, next) => {
  try {
    const result = await scanPendingEvidenceBatch(50);
    return res.json({ message: "Da kich hoat quet lai tep cho", ...result });
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
