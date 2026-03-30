CREATE TABLE IF NOT EXISTS "GoalWeeklySnapshot" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "userId" uuid NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
  "weekEnding" date NOT NULL,
  "metrics" jsonb NOT NULL DEFAULT '{}',
  "createdAt" timestamp DEFAULT now() NOT NULL,
  "updatedAt" timestamp DEFAULT now() NOT NULL,
  UNIQUE ("userId", "weekEnding")
);

CREATE INDEX IF NOT EXISTS "GoalWeeklySnapshot_userId_weekEnding_idx" ON "GoalWeeklySnapshot" ("userId", "weekEnding" DESC);

CREATE TABLE IF NOT EXISTS "BlockerIncident" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "userId" uuid NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
  "chatId" uuid REFERENCES "Chat"("id") ON DELETE SET NULL,
  "blockerKey" varchar(128) NOT NULL,
  "summary" text NOT NULL,
  "triggerGuess" text,
  "mitigationNote" text,
  "metadata" jsonb NOT NULL DEFAULT '{}',
  "occurredAt" timestamp DEFAULT now() NOT NULL,
  "createdAt" timestamp DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "BlockerIncident_userId_occurredAt_idx" ON "BlockerIncident" ("userId", "occurredAt" DESC);
