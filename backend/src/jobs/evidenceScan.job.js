const fs = require("fs");
const path = require("path");
const prisma = require("../lib/prisma");
const { scanFileWithClamAV } = require("../utils/fileSecurity");

let running = false;

async function scanPendingEvidenceBatch(limit = 20) {
  if (running) return { scanned: 0, skipped: true };
  running = true;
  try {
    const pending = await prisma.evidence.findMany({
      where: { scanStatus: "PENDING_SCAN" },
      orderBy: { uploadedAt: "asc" },
      take: limit,
    });

    let scanned = 0;
    for (const evidence of pending) {
      const relativeFilePath = evidence.fileUrl.replace(/^\/+/, "");
      const filePath = path.join(__dirname, "..", "..", relativeFilePath);
      const exists = fs.existsSync(filePath);

      if (!exists) {
        await prisma.evidence.update({
          where: { id: evidence.id },
          data: {
            scanStatus: "SCAN_ERROR",
            scanDetail: "File not found on disk",
            scannedAt: new Date(),
          },
        });
        continue;
      }

      const result = await scanFileWithClamAV(filePath);
      const status = result.status === "CLEAN" ? "CLEAN" : result.status === "INFECTED" ? "INFECTED" : "PENDING_SCAN";

      await prisma.evidence.update({
        where: { id: evidence.id },
        data: {
          scanStatus: status,
          scanDetail: result.detail || null,
          scannedAt: result.status === "CLEAN" || result.status === "INFECTED" ? new Date() : null,
        },
      });
      scanned += 1;
    }

    return { scanned, skipped: false };
  } finally {
    running = false;
  }
}

function startEvidenceScanScheduler() {
  const enabled = process.env.EVIDENCE_SCAN_SCHEDULER_ENABLED !== "false";
  if (!enabled) return;
  const intervalMs = Number(process.env.EVIDENCE_SCAN_INTERVAL_MS || 120000);
  setInterval(() => {
    scanPendingEvidenceBatch().catch((error) => {
      console.error("Evidence scan scheduler error:", error.message);
    });
  }, intervalMs);
}

module.exports = {
  scanPendingEvidenceBatch,
  startEvidenceScanScheduler,
};
