-- Add award criteria that describe the requirements for each award type.
CREATE TABLE "AwardCriterion" (
    "id" SERIAL NOT NULL,
    "awardTypeId" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "minPoint" INTEGER,
    "sortOrder" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AwardCriterion_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AwardCriterion_awardTypeId_idx" ON "AwardCriterion"("awardTypeId");

ALTER TABLE "AwardCriterion"
ADD CONSTRAINT "AwardCriterion_awardTypeId_fkey"
FOREIGN KEY ("awardTypeId") REFERENCES "AwardType"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
