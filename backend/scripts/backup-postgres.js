require("dotenv").config();

const fs = require("fs");
const path = require("path");
const { spawn } = require("child_process");

function resolvePgDumpPath() {
  if (process.env.PG_DUMP_PATH) return process.env.PG_DUMP_PATH;
  return process.platform === "win32" ? "pg_dump.exe" : "pg_dump";
}

async function main() {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL chưa được cấu hình");
  }

  const backupDir = path.resolve(process.env.BACKUP_DIR || path.join(__dirname, "..", "backups"));
  fs.mkdirSync(backupDir, { recursive: true });

  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const backupPath = path.join(backupDir, `postgres-backup-${stamp}.sql`);
  const pgDumpPath = resolvePgDumpPath();

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

  const code = await new Promise((resolve, reject) => {
    child.on("error", reject);
    child.on("close", resolve);
  });

  if (code !== 0) {
    throw new Error(stderr.trim() || `pg_dump exited with code ${code}`);
  }

  console.log(`Backup created: ${backupPath}`);
}

main().catch((error) => {
  console.error(`Backup failed: ${error.message}`);
  process.exit(1);
});
