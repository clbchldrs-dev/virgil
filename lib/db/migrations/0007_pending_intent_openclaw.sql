CREATE TABLE IF NOT EXISTS "PendingIntent" (
  "id"                   uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "userId"               uuid NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
  "chatId"               uuid REFERENCES "Chat"("id") ON DELETE SET NULL,
  "intent"               jsonb NOT NULL,
  "skill"                text,
  "status"               varchar(32) NOT NULL DEFAULT 'pending',
  "requiresConfirmation" boolean NOT NULL DEFAULT false,
  "createdAt"            timestamp DEFAULT now() NOT NULL,
  "sentAt"               timestamp,
  "result"               jsonb,
  "rejectionReason"      text
);

CREATE INDEX IF NOT EXISTS "PendingIntent_userId_status_idx" ON "PendingIntent" ("userId", "status");
CREATE INDEX IF NOT EXISTS "PendingIntent_status_sentAt_idx" ON "PendingIntent" ("status", "sentAt");
