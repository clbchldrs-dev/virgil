CREATE TABLE IF NOT EXISTS "BackgroundJob" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "userId" uuid NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
  "kind" varchar(64) NOT NULL,
  "status" varchar(32) NOT NULL DEFAULT 'pending',
  "input" jsonb NOT NULL DEFAULT '{}',
  "result" jsonb,
  "error" text,
  "createdAt" timestamp DEFAULT now() NOT NULL,
  "updatedAt" timestamp DEFAULT now() NOT NULL,
  "startedAt" timestamp,
  "completedAt" timestamp
);

CREATE INDEX IF NOT EXISTS "BackgroundJob_userId_createdAt_idx" ON "BackgroundJob" ("userId", "createdAt" DESC);
CREATE INDEX IF NOT EXISTS "BackgroundJob_userId_status_idx" ON "BackgroundJob" ("userId", "status");
