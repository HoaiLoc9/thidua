-- CreateEnum
CREATE TYPE "public"."Role" AS ENUM ('ADMIN', 'CANBO', 'GIANGVIEN', 'SINHVIEN', 'HOIDONG');

-- CreateEnum
CREATE TYPE "public"."NotificationStatus" AS ENUM ('UNREAD', 'READ');

-- CreateEnum
CREATE TYPE "public"."NominationStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "public"."ReviewLevel" AS ENUM ('DONVI', 'KHOA', 'TRUONG');

-- CreateEnum
CREATE TYPE "public"."ReviewDecision" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateTable
CREATE TABLE "public"."User" (
    "id" SERIAL NOT NULL,
    "fullName" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" "public"."Role" NOT NULL,
    "department" TEXT,
    "departmentId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Department" (
    "id" SERIAL NOT NULL,
    "departmentName" TEXT NOT NULL,
    "departmentType" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Department_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."AcademicYear" (
    "id" SERIAL NOT NULL,
    "yearName" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AcademicYear_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Criteria" (
    "id" SERIAL NOT NULL,
    "code" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "maxPoint" INTEGER NOT NULL,
    "periodYear" INTEGER,
    "academicYearId" INTEGER,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Criteria_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."AwardType" (
    "id" SERIAL NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "description" TEXT,
    "periodYear" INTEGER NOT NULL,
    "academicYearId" INTEGER,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AwardType_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Nomination" (
    "id" SERIAL NOT NULL,
    "title" TEXT NOT NULL,
    "periodYear" INTEGER NOT NULL,
    "academicYearId" INTEGER,
    "status" "public"."NominationStatus" NOT NULL DEFAULT 'DRAFT',
    "totalSelfPoint" INTEGER NOT NULL DEFAULT 0,
    "applicantId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Nomination_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."NominationItem" (
    "id" SERIAL NOT NULL,
    "nominationId" INTEGER NOT NULL,
    "criteriaId" INTEGER NOT NULL,
    "selfPoint" INTEGER NOT NULL,
    "evidence" TEXT,

    CONSTRAINT "NominationItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ReviewStep" (
    "id" SERIAL NOT NULL,
    "nominationId" INTEGER NOT NULL,
    "reviewerId" INTEGER NOT NULL,
    "level" "public"."ReviewLevel" NOT NULL,
    "decision" "public"."ReviewDecision" NOT NULL DEFAULT 'PENDING',
    "comment" TEXT,
    "reviewedAt" TIMESTAMP(3),

    CONSTRAINT "ReviewStep_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Evidence" (
    "id" SERIAL NOT NULL,
    "nominationId" INTEGER NOT NULL,
    "fileUrl" TEXT NOT NULL,
    "description" TEXT,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Evidence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ApprovalProcess" (
    "id" SERIAL NOT NULL,
    "processName" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ApprovalProcess_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ApprovalStep" (
    "id" SERIAL NOT NULL,
    "processId" INTEGER NOT NULL,
    "stepOrder" INTEGER NOT NULL,
    "role" "public"."Role" NOT NULL,
    "description" TEXT,

    CONSTRAINT "ApprovalStep_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ApprovalResult" (
    "id" SERIAL NOT NULL,
    "nominationId" INTEGER NOT NULL,
    "approverId" INTEGER NOT NULL,
    "status" "public"."ReviewDecision" NOT NULL,
    "comment" TEXT,
    "approvalDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ApprovalResult_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Notification" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "message" TEXT NOT NULL,
    "status" "public"."NotificationStatus" NOT NULL DEFAULT 'UNREAD',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."AuditLog" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "action" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "description" TEXT,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "public"."User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Department_departmentName_key" ON "public"."Department"("departmentName");

-- CreateIndex
CREATE UNIQUE INDEX "AcademicYear_yearName_key" ON "public"."AcademicYear"("yearName");

-- CreateIndex
CREATE UNIQUE INDEX "Criteria_code_key" ON "public"."Criteria"("code");

-- CreateIndex
CREATE UNIQUE INDEX "AwardType_code_key" ON "public"."AwardType"("code");

-- CreateIndex
CREATE UNIQUE INDEX "NominationItem_nominationId_criteriaId_key" ON "public"."NominationItem"("nominationId", "criteriaId");

-- CreateIndex
CREATE UNIQUE INDEX "ReviewStep_nominationId_reviewerId_level_key" ON "public"."ReviewStep"("nominationId", "reviewerId", "level");

-- CreateIndex
CREATE UNIQUE INDEX "ApprovalStep_processId_stepOrder_key" ON "public"."ApprovalStep"("processId", "stepOrder");

-- AddForeignKey
ALTER TABLE "public"."User" ADD CONSTRAINT "User_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "public"."Department"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Criteria" ADD CONSTRAINT "Criteria_academicYearId_fkey" FOREIGN KEY ("academicYearId") REFERENCES "public"."AcademicYear"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."AwardType" ADD CONSTRAINT "AwardType_academicYearId_fkey" FOREIGN KEY ("academicYearId") REFERENCES "public"."AcademicYear"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Nomination" ADD CONSTRAINT "Nomination_academicYearId_fkey" FOREIGN KEY ("academicYearId") REFERENCES "public"."AcademicYear"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Nomination" ADD CONSTRAINT "Nomination_applicantId_fkey" FOREIGN KEY ("applicantId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."NominationItem" ADD CONSTRAINT "NominationItem_nominationId_fkey" FOREIGN KEY ("nominationId") REFERENCES "public"."Nomination"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."NominationItem" ADD CONSTRAINT "NominationItem_criteriaId_fkey" FOREIGN KEY ("criteriaId") REFERENCES "public"."Criteria"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ReviewStep" ADD CONSTRAINT "ReviewStep_nominationId_fkey" FOREIGN KEY ("nominationId") REFERENCES "public"."Nomination"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ReviewStep" ADD CONSTRAINT "ReviewStep_reviewerId_fkey" FOREIGN KEY ("reviewerId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Evidence" ADD CONSTRAINT "Evidence_nominationId_fkey" FOREIGN KEY ("nominationId") REFERENCES "public"."Nomination"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ApprovalStep" ADD CONSTRAINT "ApprovalStep_processId_fkey" FOREIGN KEY ("processId") REFERENCES "public"."ApprovalProcess"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ApprovalResult" ADD CONSTRAINT "ApprovalResult_nominationId_fkey" FOREIGN KEY ("nominationId") REFERENCES "public"."Nomination"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ApprovalResult" ADD CONSTRAINT "ApprovalResult_approverId_fkey" FOREIGN KEY ("approverId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."AuditLog" ADD CONSTRAINT "AuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
