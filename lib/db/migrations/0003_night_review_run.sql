CREATE TABLE IF NOT EXISTS "NightReviewRun" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "userId" uuid NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
  "windowKey" varchar(32) NOT NULL,
  "runId" uuid NOT NULL,
  "modelId" text NOT NULL,
  "outcome" varchar(32) NOT NULL,
  "durationMs" integer NOT NULL,
  "error" text,
  "createdAt" timestamp DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "NightReviewRun_userId_createdAt_idx"
  ON "NightReviewRun" ("userId", "createdAt" DESC);
