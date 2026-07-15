-- Nullable columns make this migration backward-compatible with existing rows.
ALTER TABLE "KSeFSchedule"
ADD COLUMN "lastError" TEXT,
ADD COLUMN "lastErrorAt" TIMESTAMP(3),
ADD COLUMN "lockToken" TEXT,
ADD COLUMN "lockedAt" TIMESTAMP(3);

CREATE INDEX "KSeFSchedule_isActive_hour_minute_idx"
ON "KSeFSchedule"("isActive", "hour", "minute");
