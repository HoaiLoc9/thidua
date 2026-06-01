-- Link nominations to award types and evidences to award criteria.
ALTER TABLE "Nomination" ADD COLUMN "awardTypeId" INTEGER;
ALTER TABLE "Evidence" ADD COLUMN "awardCriterionId" INTEGER;

CREATE INDEX "Nomination_awardTypeId_idx" ON "Nomination"("awardTypeId");
CREATE INDEX "Evidence_awardCriterionId_idx" ON "Evidence"("awardCriterionId");

ALTER TABLE "Nomination"
ADD CONSTRAINT "Nomination_awardTypeId_fkey"
FOREIGN KEY ("awardTypeId") REFERENCES "AwardType"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Evidence"
ADD CONSTRAINT "Evidence_awardCriterionId_fkey"
FOREIGN KEY ("awardCriterionId") REFERENCES "AwardCriterion"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
