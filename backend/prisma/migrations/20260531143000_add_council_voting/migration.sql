-- CreateEnum
CREATE TYPE "CouncilVoteChoice" AS ENUM ('AGREE', 'DISAGREE', 'REVIEW_AGAIN');

-- CreateEnum
CREATE TYPE "ScoreAdjustmentAction" AS ENUM ('KEEP', 'ADJUST', 'CANCEL');

-- CreateTable
CREATE TABLE "CouncilVote" (
    "id" SERIAL NOT NULL,
    "nominationId" INTEGER NOT NULL,
    "voterId" INTEGER NOT NULL,
    "choice" "CouncilVoteChoice" NOT NULL,
    "comment" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CouncilVote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScoreAdjustment" (
    "id" SERIAL NOT NULL,
    "nominationId" INTEGER NOT NULL,
    "evidenceId" INTEGER NOT NULL,
    "adjustedById" INTEGER NOT NULL,
    "action" "ScoreAdjustmentAction" NOT NULL,
    "oldPoint" INTEGER,
    "newPoint" INTEGER,
    "reason" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ScoreAdjustment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CouncilVote_nominationId_voterId_key" ON "CouncilVote"("nominationId", "voterId");

-- CreateIndex
CREATE INDEX "CouncilVote_nominationId_idx" ON "CouncilVote"("nominationId");

-- CreateIndex
CREATE INDEX "CouncilVote_voterId_idx" ON "CouncilVote"("voterId");

-- CreateIndex
CREATE INDEX "ScoreAdjustment_nominationId_idx" ON "ScoreAdjustment"("nominationId");

-- CreateIndex
CREATE INDEX "ScoreAdjustment_evidenceId_idx" ON "ScoreAdjustment"("evidenceId");

-- CreateIndex
CREATE INDEX "ScoreAdjustment_adjustedById_idx" ON "ScoreAdjustment"("adjustedById");

-- AddForeignKey
ALTER TABLE "CouncilVote" ADD CONSTRAINT "CouncilVote_nominationId_fkey" FOREIGN KEY ("nominationId") REFERENCES "Nomination"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CouncilVote" ADD CONSTRAINT "CouncilVote_voterId_fkey" FOREIGN KEY ("voterId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScoreAdjustment" ADD CONSTRAINT "ScoreAdjustment_nominationId_fkey" FOREIGN KEY ("nominationId") REFERENCES "Nomination"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScoreAdjustment" ADD CONSTRAINT "ScoreAdjustment_evidenceId_fkey" FOREIGN KEY ("evidenceId") REFERENCES "Evidence"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScoreAdjustment" ADD CONSTRAINT "ScoreAdjustment_adjustedById_fkey" FOREIGN KEY ("adjustedById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
