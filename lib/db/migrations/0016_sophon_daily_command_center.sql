-- Sophon daily command center persistence (tasks, habits, action logs, and reviews).
CREATE TABLE IF NOT EXISTS "SophonTask" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "userId" uuid NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
  "title" text NOT NULL,
  "status" varchar(24) NOT NULL DEFAULT 'open',
  "source" varchar(24) NOT NULL DEFAULT 'manual',
  "dueAt" timestamp,
  "effortFit" integer NOT NULL DEFAULT 50,
  "createdAt" timestamp NOT NULL DEFAULT now(),
  "updatedAt" timestamp NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "SophonHabitState" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "userId" uuid NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
  "habitKey" varchar(128) NOT NULL,
  "lastReviewedAt" timestamp,
  "stalenessStage" integer NOT NULL DEFAULT 0,
  "cooldownUntil" timestamp,
  "updatedAt" timestamp NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS "SophonHabitState_userId_habitKey_unique"
  ON "SophonHabitState" ("userId", "habitKey");

CREATE TABLE IF NOT EXISTS "SophonActionLog" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "userId" uuid NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
  "actionType" varchar(64) NOT NULL,
  "riskLevel" varchar(16) NOT NULL,
  "mode" varchar(16) NOT NULL,
  "metadata" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "createdAt" timestamp NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "SophonDailyReview" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "userId" uuid NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
  "reviewDate" date NOT NULL,
  "wins" text[] NOT NULL DEFAULT '{}'::text[],
  "misses" text[] NOT NULL DEFAULT '{}'::text[],
  "carryForward" text[] NOT NULL DEFAULT '{}'::text[],
  "calibration" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "createdAt" timestamp NOT NULL DEFAULT now(),
  "updatedAt" timestamp NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS "SophonDailyReview_userId_reviewDate_unique"
  ON "SophonDailyReview" ("userId", "reviewDate");
