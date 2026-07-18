-- Preflight (read-only) before applying in an environment with existing data:
-- SELECT lower(trim("name")), coalesce("parentId", '__root__'), count(*)
-- FROM "Category"
-- GROUP BY 1, 2
-- HAVING count(*) > 1;
--
-- The unique index below intentionally aborts the migration when duplicates
-- exist. It never removes or merges user data automatically.

ALTER TABLE "Category"
  ADD COLUMN "nameNormalized" TEXT,
  ADD COLUMN "parentScope" TEXT;

UPDATE "Category"
SET
  "nameNormalized" = lower(trim("name")),
  "parentScope" = coalesce("parentId", '__root__');

ALTER TABLE "Category"
  ALTER COLUMN "nameNormalized" SET NOT NULL,
  ALTER COLUMN "parentScope" SET NOT NULL;

CREATE UNIQUE INDEX "Category_parentScope_nameNormalized_key"
  ON "Category"("parentScope", "nameNormalized");

ALTER TABLE "Document" RENAME COLUMN "filePath" TO "fileKey";

-- Existing absolute Windows/Linux paths are converted to their generated
-- basename. The application has always generated UUID filenames, so no user
-- supplied directory information is required to resolve an attachment.
UPDATE "Document"
SET "fileKey" = regexp_replace(replace("fileKey", chr(92), '/'), '^.*/', '')
WHERE "fileKey" IS NOT NULL;

CREATE INDEX "Document_status_issueDate_id_idx"
  ON "Document"("status", "issueDate", "id");
CREATE INDEX "Document_status_dueDate_id_idx"
  ON "Document"("status", "dueDate", "id");
CREATE INDEX "Document_status_createdAt_id_idx"
  ON "Document"("status", "createdAt", "id");

CREATE TABLE "AttachmentCleanupTask" (
  "id" TEXT NOT NULL,
  "fileKey" TEXT NOT NULL,
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "lastError" TEXT,
  "nextAttemptAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AttachmentCleanupTask_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AttachmentCleanupTask_fileKey_key"
  ON "AttachmentCleanupTask"("fileKey");
CREATE INDEX "AttachmentCleanupTask_nextAttemptAt_idx"
  ON "AttachmentCleanupTask"("nextAttemptAt");
