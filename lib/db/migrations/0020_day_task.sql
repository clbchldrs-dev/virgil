CREATE TABLE IF NOT EXISTS "DayTask" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "userId" uuid NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
  "forDate" date NOT NULL,
  "title" text NOT NULL,
  "sortOrder" integer NOT NULL,
  "completedAt" timestamp,
  "createdAt" timestamp NOT NULL DEFAULT now(),
  "updatedAt" timestamp NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS "DayTask_userId_forDate_sortOrder_unique" ON "DayTask" ("userId", "forDate", "sortOrder");
CREATE INDEX IF NOT EXISTS "DayTask_userId_forDate_idx" ON "DayTask" ("userId", "forDate");
