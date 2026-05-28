-- CreateEnum
CREATE TYPE "EvidenceScanStatus" AS ENUM ('PENDING_SCAN', 'CLEAN', 'INFECTED', 'SCAN_ERROR');

-- AlterTable
ALTER TABLE "Evidence"
ADD COLUMN "scanStatus" "EvidenceScanStatus" NOT NULL DEFAULT 'PENDING_SCAN',
ADD COLUMN "fileHash" TEXT,
ADD COLUMN "scanDetail" TEXT,
ADD COLUMN "scannedAt" TIMESTAMP(3);
