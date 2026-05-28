-- CreateTable
CREATE TABLE "CriteriaSubItem" (
    "id" SERIAL NOT NULL,
    "criteriaId" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "maxPoint" INTEGER NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CriteriaSubItem_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "CriteriaSubItem" ADD CONSTRAINT "CriteriaSubItem_criteriaId_fkey" FOREIGN KEY ("criteriaId") REFERENCES "Criteria"("id") ON DELETE CASCADE ON UPDATE CASCADE;
