-- AlterTable
ALTER TABLE "Nomination" ADD COLUMN "isArchived" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "archivedAt" TIMESTAMP(3),
ADD COLUMN "archivedById" INTEGER;

-- CreateIndex
CREATE INDEX "Nomination_isArchived_idx" ON "Nomination"("isArchived");

-- CreateIndex
CREATE INDEX "Nomination_archivedById_idx" ON "Nomination"("archivedById");

-- AddForeignKey
ALTER TABLE "Nomination" ADD CONSTRAINT "Nomination_archivedById_fkey" FOREIGN KEY ("archivedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
