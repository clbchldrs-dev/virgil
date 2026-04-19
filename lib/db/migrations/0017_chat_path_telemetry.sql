CREATE TABLE IF NOT EXISTS "ChatPathTelemetry" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "userId" uuid NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
  "chatId" uuid REFERENCES "Chat"("id") ON DELETE SET NULL,
  "requestedModelId" text NOT NULL,
  "effectiveModelId" text NOT NULL,
  "requestedPath" varchar(16) NOT NULL,
  "effectivePath" varchar(16) NOT NULL,
  "fallbackTier" varchar(16),
  "outcome" varchar(16) NOT NULL,
  "errorCode" varchar(64),
  "createdAt" timestamp NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "ChatPathTelemetry_userId_createdAt_idx"
  ON "ChatPathTelemetry" ("userId", "createdAt");

CREATE INDEX IF NOT EXISTS "ChatPathTelemetry_userId_effectivePath_createdAt_idx"
  ON "ChatPathTelemetry" ("userId", "effectivePath", "createdAt");

CREATE INDEX IF NOT EXISTS "ChatPathTelemetry_userId_outcome_createdAt_idx"
  ON "ChatPathTelemetry" ("userId", "outcome", "createdAt");
