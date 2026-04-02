# Pivot — Goals layer SSOT (extend vs new tables)

**Track:** [Proactive pivot epic](2026-04-02-proactive-pivot-epic.md)  
**Status:** Design approved for implementation planning — **no migration applied in this ticket**

## Problem

The external pivot prompt proposes new `goals` and `goal_checkins` tables. v1 already has **`GoalWeeklySnapshot`** ([`lib/db/schema.ts`](../../lib/db/schema.ts)) with flexible `metrics` JSON, unique on `(userId, weekEnding)`, plus goal-guidance prompts and APIs under `app/(chat)/api/goal-guidance/`. Duplicating “goals” in parallel tables risks drift and confusing tool surfaces.

## Recommendation (SSOT strategy)

**Phase A — extend what exists**

1. Treat **`GoalWeeklySnapshot`** as the **canonical weekly rollup** (already aligned with [OWNER_PRODUCT_VISION.md](../OWNER_PRODUCT_VISION.md) metrics keys).
2. Add **structured cadence goals** by either:
   - **Option A1 (preferred for smallest diff):** New table `Goal` (or `UserGoal`) for **title, category, status, cadence, blockers[], streak fields**, with **optional** `linkWeekEnding` or derived reporting into snapshots; **check-ins** as `GoalCheckIn` rows referencing `goalId`, **or**
   - **Option A2:** Encode cadence goals only in `Memory` rows (`kind: goal`) with strict metadata schema — weaker for SQL queries and stale-goal polling.

**Phase B — avoid replacing `GoalWeeklySnapshot`**

- Weekly metrics remain the **time-series** truth; `Goal` rows are the **intent / streak** truth. Tools (`listGoals`, `checkInGoal`) read/write both where needed (e.g. check-in updates `Goal` and may suggest updating the current week’s snapshot via existing goal-guidance flow).

## Sketch: `Goal` + `GoalCheckIn` (if A1)

```sql
-- Illustrative — final columns follow Drizzle conventions in repo
CREATE TABLE "Goal" (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "userId" UUID NOT NULL REFERENCES "User"(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  category TEXT NOT NULL, -- health | career | creative | learning | personal
  description TEXT,
  "targetCadence" TEXT, -- daily | weekly | monthly | null
  status TEXT NOT NULL DEFAULT 'active', -- active | paused | completed | abandoned
  "lastTouchedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "streakCurrent" INTEGER NOT NULL DEFAULT 0,
  "streakBest" INTEGER NOT NULL DEFAULT 0,
  blockers TEXT[] NOT NULL DEFAULT '{}',
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE "GoalCheckIn" (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "goalId" UUID NOT NULL REFERENCES "Goal"(id) ON DELETE CASCADE,
  "checkedInAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  notes TEXT,
  source TEXT NOT NULL DEFAULT 'manual' -- manual | inferred | event
);
CREATE INDEX ON "GoalCheckIn" ("goalId", "checkedInAt");
```

## Integration points

- **`buildGoalContext()`** (pivot prompt): load active `Goal` rows + latest `GoalWeeklySnapshot` for current week; slim path: stale goals + intent-gated subset (see epic Phase 4).
- **Seed script:** pivot prompt lists owner priorities — implement as **idempotent seed** or **one-off** script under `scripts/`, not committed secrets; aligns with existing `lib/db/seed.ts` patterns.
- **`getStaleGoals(thresholdDays)`:** SQL over `Goal.lastTouchedAt` (or last check-in subquery), not over weekly snapshot alone. Nudge delivery topology: [PIVOT_EVENTS_AND_NUDGES.md](../PIVOT_EVENTS_AND_NUDGES.md).

## Acceptance criteria (this ticket)

1. This document is linked from the [pivot epic](2026-04-02-proactive-pivot-epic.md).
2. Implementing engineers choose **A1 vs A2** in the first migration PR and record the choice in [DECISIONS.md](../DECISIONS.md) if schema ships.
3. No duplicate “weekly metrics” SSOT: `GoalWeeklySnapshot` stays authoritative for **week-keyed metrics** unless explicitly superseded by a future ADR.

## Key files

- [`lib/db/schema.ts`](../../lib/db/schema.ts) — `goalWeeklySnapshot`, `memory`
- `app/(chat)/api/goal-guidance/`, `lib/ai/goal-guidance-prompt.ts`
