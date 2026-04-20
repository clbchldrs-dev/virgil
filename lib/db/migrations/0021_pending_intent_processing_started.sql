-- Track when poll worker claimed an intent (processing) for stale reclaim if the worker dies mid-run.
ALTER TABLE "PendingIntent"
  ADD COLUMN IF NOT EXISTS "processingStartedAt" timestamp;

-- Best-effort backfill for rows already stuck in processing (rare).
UPDATE "PendingIntent"
SET "processingStartedAt" = COALESCE("sentAt", "createdAt")
WHERE "status" = 'processing'
  AND "awaitingPollWorker" = true
  AND "result" IS NULL
  AND "processingStartedAt" IS NULL;

CREATE INDEX IF NOT EXISTS "PendingIntent_processing_reclaim_idx"
  ON "PendingIntent" ("status", "awaitingPollWorker", "processingStartedAt")
  WHERE "status" = 'processing' AND "awaitingPollWorker" = true;
