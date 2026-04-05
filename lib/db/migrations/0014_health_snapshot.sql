-- Apple Health / Watch companion ingest (Bearer API). See AGENTS.md (health ingest + calendar).
CREATE TABLE IF NOT EXISTS "HealthSnapshot" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "userId" uuid NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
  "periodStart" timestamptz NOT NULL,
  "periodEnd" timestamptz NOT NULL,
  "source" varchar(64) NOT NULL DEFAULT 'apple-health',
  "payload" jsonb NOT NULL DEFAULT '{}',
  "createdAt" timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "HealthSnapshot_userId_createdAt_idx"
  ON "HealthSnapshot" ("userId", "createdAt" DESC);
