-- CreateEnum
CREATE TYPE "SubmissionType" AS ENUM ('INDIVIDUAL', 'GROUP');

-- CreateEnum
CREATE TYPE "NominationMemberRole" AS ENUM ('STUDENT', 'LECTURER', 'ADVISOR', 'CO_AUTHOR', 'LEADER');

-- AlterTable
ALTER TABLE "Nomination" ADD COLUMN "submissionType" "SubmissionType" NOT NULL DEFAULT 'INDIVIDUAL',
ADD COLUMN "groupName" TEXT;

-- CreateTable
CREATE TABLE "NominationMember" (
    "id" SERIAL NOT NULL,
    "nominationId" INTEGER NOT NULL,
    "userId" INTEGER,
    "fullName" TEXT NOT NULL,
    "email" TEXT,
    "memberRole" "NominationMemberRole" NOT NULL,
    "contribution" TEXT,
    "isLeader" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NominationMember_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "NominationMember_nominationId_idx" ON "NominationMember"("nominationId");

-- CreateIndex
CREATE INDEX "NominationMember_userId_idx" ON "NominationMember"("userId");

-- AddForeignKey
ALTER TABLE "NominationMember" ADD CONSTRAINT "NominationMember_nominationId_fkey" FOREIGN KEY ("nominationId") REFERENCES "Nomination"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NominationMember" ADD CONSTRAINT "NominationMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
