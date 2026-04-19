ALTER TABLE "User"
  ADD COLUMN IF NOT EXISTS "role" varchar(16) NOT NULL DEFAULT 'user';

CREATE TABLE IF NOT EXISTS "FlightDeckOperatorAudit" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "userId" uuid NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
  "action" varchar(32) NOT NULL,
  "requestId" varchar(128) NOT NULL,
  "actionToken" varchar(128) NOT NULL,
  "status" varchar(16) NOT NULL,
  "reason" text,
  "metadata" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "createdAt" timestamp NOT NULL DEFAULT now(),
  "completedAt" timestamp
);

CREATE INDEX IF NOT EXISTS "FlightDeckOperatorAudit_userId_action_createdAt_idx"
  ON "FlightDeckOperatorAudit" ("userId", "action", "createdAt");

CREATE UNIQUE INDEX IF NOT EXISTS "FlightDeckOperatorAudit_userId_action_requestId_unique"
  ON "FlightDeckOperatorAudit" ("userId", "action", "requestId");

CREATE UNIQUE INDEX IF NOT EXISTS "FlightDeckOperatorAudit_userId_action_actionToken_unique"
  ON "FlightDeckOperatorAudit" ("userId", "action", "actionToken");
