ALTER TABLE "Criteria"
ADD COLUMN IF NOT EXISTS "reviewLevel" TEXT NOT NULL DEFAULT 'DONVI';

UPDATE "Criteria"
SET "reviewLevel" = 'DONVI'
WHERE "reviewLevel" IS NULL OR "reviewLevel" = '';
