ALTER TABLE "PendingIntent"
  ADD COLUMN IF NOT EXISTS "awaitingPollWorker" boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS "PendingIntent_poll_worker_idx"
  ON "PendingIntent" ("status", "awaitingPollWorker", "sentAt")
  WHERE "awaitingPollWorker" = true;
