-- E11 Phase 2: structured cadence goals (pivot goals layer). GoalWeeklySnapshot remains for weekly metrics.
CREATE TABLE IF NOT EXISTS "Goal" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "userId" uuid NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
  "title" text NOT NULL,
  "category" varchar(32) NOT NULL,
  "description" text,
  "targetCadence" varchar(32),
  "status" varchar(32) NOT NULL DEFAULT 'active',
  "lastTouchedAt" timestamp NOT NULL DEFAULT now(),
  "streakCurrent" integer NOT NULL DEFAULT 0,
  "streakBest" integer NOT NULL DEFAULT 0,
  "blockers" text[] NOT NULL DEFAULT '{}',
  "createdAt" timestamp NOT NULL DEFAULT now(),
  "updatedAt" timestamp NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "Goal_userId_status_idx" ON "Goal" ("userId", "status");

CREATE TABLE IF NOT EXISTS "GoalCheckIn" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "goalId" uuid NOT NULL REFERENCES "Goal"("id") ON DELETE CASCADE,
  "checkedInAt" timestamp NOT NULL DEFAULT now(),
  "notes" text,
  "source" varchar(32) NOT NULL DEFAULT 'manual'
);

CREATE INDEX IF NOT EXISTS "GoalCheckIn_goalId_checkedInAt_idx" ON "GoalCheckIn" ("goalId", "checkedInAt" DESC);
