-- BJJ / drill-coach optional profile + protein log (single-athlete; see docs/BJJ_COACH_PRODUCT.md).
CREATE TABLE IF NOT EXISTS "CoachingProfile" (
  "userId" uuid PRIMARY KEY NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
  "training" jsonb NOT NULL DEFAULT '{}',
  "recovery" jsonb NOT NULL DEFAULT '{}',
  "commitments" jsonb NOT NULL DEFAULT '{}',
  "schemaVersion" integer NOT NULL DEFAULT 1,
  "updatedAt" timestamp NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "ProteinDailyLog" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "userId" uuid NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
  "day" date NOT NULL,
  "targetGrams" integer,
  "loggedGramsEstimate" integer,
  "notes" text,
  "createdAt" timestamp NOT NULL DEFAULT now(),
  "updatedAt" timestamp NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS "ProteinDailyLog_userId_day_unique" ON "ProteinDailyLog" ("userId", "day");
CREATE INDEX IF NOT EXISTS "ProteinDailyLog_userId_day_idx" ON "ProteinDailyLog" ("userId", "day" DESC);
