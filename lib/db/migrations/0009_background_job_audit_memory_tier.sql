ALTER TABLE "BackgroundJob" ADD COLUMN IF NOT EXISTS "wallTimeMs" integer;
ALTER TABLE "BackgroundJob" ADD COLUMN IF NOT EXISTS "retryCount" integer NOT NULL DEFAULT 0;
ALTER TABLE "BackgroundJob" ADD COLUMN IF NOT EXISTS "proposalCount" integer NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS "BackgroundJobAudit" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "jobId" uuid NOT NULL REFERENCES "BackgroundJob"("id") ON DELETE CASCADE,
  "userId" uuid NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
  "oldStatus" varchar(64) NOT NULL,
  "newStatus" varchar(64) NOT NULL,
  "actor" varchar(128) NOT NULL,
  "reason" text,
  "createdAt" timestamp DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "BackgroundJobAudit_jobId_createdAt_idx" ON "BackgroundJobAudit" ("jobId", "createdAt");

ALTER TABLE "Memory" ADD COLUMN IF NOT EXISTS "tier" varchar(32) NOT NULL DEFAULT 'observe';
ALTER TABLE "Memory" ADD COLUMN IF NOT EXISTS "proposedAt" timestamp;
ALTER TABLE "Memory" ADD COLUMN IF NOT EXISTS "approvedAt" timestamp;
ALTER TABLE "Memory" ADD COLUMN IF NOT EXISTS "appliedAt" timestamp;
