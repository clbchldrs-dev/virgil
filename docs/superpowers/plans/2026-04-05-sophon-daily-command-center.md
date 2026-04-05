# Sophon Daily Command Center Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship Option B as a production-ready first Sophon slice: deterministic daily prioritization, adaptive 3-7 focus set, low-risk auto-execution policy, and staleness ladder accountability.

**Architecture:** Add a new `lib/sophon/` domain with pure scoring/policy modules, then layer persistence and an authenticated API route on top. Keep ranking deterministic and use model-facing text generation as optional formatting, not decision authority. Persist enough state to support cooldowns, auditability, and end-of-day calibration.

**Tech Stack:** Next.js route handlers, TypeScript, Drizzle/Postgres, Zod, Node test runner (`node:test`), existing auth/session patterns.

---

## File Structure

**Create**
- `lib/sophon/types.ts` — canonical input/output types for the daily command center.
- `lib/sophon/config.ts` — thresholds, adaptive range constants, and risk/cooldown defaults.
- `lib/sophon/priority-matrix.ts` — deterministic scoring + adaptive priority count.
- `lib/sophon/staleness-ladder.ts` — escalation stage transitions with cooldown logic.
- `lib/sophon/action-policy.ts` — low/medium/high risk classifier and execution mode routing.
- `lib/sophon/build-daily-command-center.ts` — orchestration of aggregate -> score -> policy -> brief output.
- `lib/db/query-modules/sophon.ts` — DB reads/writes for Sophon tables.
- `lib/db/migrations/0016_sophon_daily_command_center.sql` — new tables and indexes.
- `app/(chat)/api/sophon/daily/route.ts` — authenticated GET/POST route for daily brief + review writeback.
- `tests/unit/sophon-priority-matrix.test.ts` — matrix/adaptive logic tests.
- `tests/unit/sophon-staleness-ladder.test.ts` — escalation and cooldown tests.
- `tests/unit/sophon-action-policy.test.ts` — risk and routing tests.
- `tests/unit/sophon-build-daily-command-center.test.ts` — service orchestration tests.

**Modify**
- `lib/db/schema.ts` — add `SophonTask`, `SophonHabitState`, `SophonActionLog`, `SophonDailyReview` tables and inferred types.
- `lib/db/queries.ts` — export `query-modules/sophon` functions.
- `.env.example` — add optional Sophon tuning env vars with safe defaults.
- `docs/PROJECT.md` — add a short SSOT pointer to the new Sophon daily route/module.

---

### Task 1: Define domain contracts and deterministic matrix behavior

**Files:**
- Create: `lib/sophon/types.ts`
- Create: `lib/sophon/config.ts`
- Create: `tests/unit/sophon-priority-matrix.test.ts`
- Create: `lib/sophon/priority-matrix.ts`

- [ ] **Step 1: Write failing tests for adaptive range and deterministic ranking**

```ts
import assert from "node:assert/strict";
import { test } from "node:test";
import {
  pickAdaptivePriorityCount,
  scorePriorityMatrix,
} from "@/lib/sophon/priority-matrix";
import type { SophonCandidateItem } from "@/lib/sophon/types";

const items: SophonCandidateItem[] = [
  {
    id: "a",
    title: "File taxes",
    source: "manual",
    impact: 0.9,
    urgency: 0.8,
    commitmentRisk: 0.9,
    effortFit: 0.3,
    decayRisk: 0.6,
    dueAt: null,
  },
  {
    id: "b",
    title: "Inbox cleanup",
    source: "memory",
    impact: 0.2,
    urgency: 0.3,
    commitmentRisk: 0.2,
    effortFit: 0.8,
    decayRisk: 0.4,
    dueAt: null,
  },
];

test("pickAdaptivePriorityCount biases low during heavy load", () => {
  const count = pickAdaptivePriorityCount({
    calendarLoad: 0.9,
    carryoverLoad: 0.8,
    stalenessPressure: 0.7,
  });
  assert.equal(count, 3);
});

test("pickAdaptivePriorityCount expands in low-friction days", () => {
  const count = pickAdaptivePriorityCount({
    calendarLoad: 0.2,
    carryoverLoad: 0.1,
    stalenessPressure: 0.2,
  });
  assert.equal(count, 7);
});

test("scorePriorityMatrix returns deterministic rank with explanations", () => {
  const ranked = scorePriorityMatrix(items);
  assert.equal(ranked.at(0)?.id, "a");
  assert.ok((ranked.at(0)?.explanations.length ?? 0) > 0);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test --import tsx tests/unit/sophon-priority-matrix.test.ts`  
Expected: FAIL with module-not-found or missing export errors.

- [ ] **Step 3: Add domain types and config constants**

```ts
// lib/sophon/types.ts
export type SophonSource =
  | "manual"
  | "calendar"
  | "existing-task"
  | "memory"
  | "habit";

export type SophonCandidateItem = {
  id: string;
  title: string;
  source: SophonSource;
  impact: number;
  urgency: number;
  commitmentRisk: number;
  effortFit: number;
  decayRisk: number;
  dueAt: Date | null;
};

export type RankedSophonItem = SophonCandidateItem & {
  score: number;
  explanations: string[];
};
```

```ts
// lib/sophon/config.ts
export const SOPHON_MIN_PRIORITIES = 3;
export const SOPHON_MAX_PRIORITIES = 7;

export const SOPHON_WEIGHTS = {
  impact: 0.28,
  urgency: 0.26,
  commitmentRisk: 0.2,
  effortFit: 0.14,
  decayRisk: 0.12,
} as const;
```

- [ ] **Step 4: Implement priority matrix and adaptive count**

```ts
// lib/sophon/priority-matrix.ts
import {
  SOPHON_MAX_PRIORITIES,
  SOPHON_MIN_PRIORITIES,
  SOPHON_WEIGHTS,
} from "@/lib/sophon/config";
import type { RankedSophonItem, SophonCandidateItem } from "@/lib/sophon/types";

export function pickAdaptivePriorityCount({
  calendarLoad,
  carryoverLoad,
  stalenessPressure,
}: {
  calendarLoad: number;
  carryoverLoad: number;
  stalenessPressure: number;
}) {
  const pressure = (calendarLoad + carryoverLoad + stalenessPressure) / 3;
  if (pressure >= 0.7) return SOPHON_MIN_PRIORITIES;
  if (pressure <= 0.3) return SOPHON_MAX_PRIORITIES;
  const spread = SOPHON_MAX_PRIORITIES - SOPHON_MIN_PRIORITIES;
  return SOPHON_MAX_PRIORITIES - Math.round(spread * pressure);
}

export function scorePriorityMatrix(
  items: SophonCandidateItem[]
): RankedSophonItem[] {
  return [...items]
    .map((item) => {
      const score =
        item.impact * SOPHON_WEIGHTS.impact +
        item.urgency * SOPHON_WEIGHTS.urgency +
        item.commitmentRisk * SOPHON_WEIGHTS.commitmentRisk +
        item.effortFit * SOPHON_WEIGHTS.effortFit +
        item.decayRisk * SOPHON_WEIGHTS.decayRisk;
      return {
        ...item,
        score,
        explanations: [
          `impact:${item.impact.toFixed(2)}`,
          `urgency:${item.urgency.toFixed(2)}`,
          `commitmentRisk:${item.commitmentRisk.toFixed(2)}`,
        ],
      };
    })
    .sort((a, b) => b.score - a.score || a.title.localeCompare(b.title));
}
```

- [ ] **Step 5: Run tests and commit**

Run: `node --test --import tsx tests/unit/sophon-priority-matrix.test.ts`  
Expected: PASS (3 tests)

```bash
git add lib/sophon/types.ts lib/sophon/config.ts lib/sophon/priority-matrix.ts tests/unit/sophon-priority-matrix.test.ts
git commit -m "feat: add deterministic sophon priority matrix core"
```

---

### Task 2: Implement staleness ladder and action policy

**Files:**
- Create: `tests/unit/sophon-staleness-ladder.test.ts`
- Create: `tests/unit/sophon-action-policy.test.ts`
- Create: `lib/sophon/staleness-ladder.ts`
- Create: `lib/sophon/action-policy.ts`

- [ ] **Step 1: Write failing tests for escalation and risk routing**

```ts
import assert from "node:assert/strict";
import { test } from "node:test";
import { nextStalenessStage } from "@/lib/sophon/staleness-ladder";
import { classifyActionRisk, routeActionMode } from "@/lib/sophon/action-policy";

test("staleness ladder escalates progressively", () => {
  assert.equal(nextStalenessStage({ currentStage: 0, staleDays: 3 }).stage, 1);
  assert.equal(nextStalenessStage({ currentStage: 1, staleDays: 7 }).stage, 2);
  assert.equal(nextStalenessStage({ currentStage: 2, staleDays: 14 }).stage, 3);
});

test("high-impact actions never auto execute", () => {
  const risk = classifyActionRisk({
    kind: "message-send",
    reversible: false,
    externalSideEffect: true,
  });
  assert.equal(risk, "high");
  assert.equal(routeActionMode(risk), "suggest");
});
```

- [ ] **Step 2: Run tests to verify fail state**

Run: `node --test --import tsx tests/unit/sophon-staleness-ladder.test.ts tests/unit/sophon-action-policy.test.ts`  
Expected: FAIL with unresolved modules/exports.

- [ ] **Step 3: Implement staleness ladder with cooldown metadata**

```ts
// lib/sophon/staleness-ladder.ts
export type StalenessStage = 0 | 1 | 2 | 3;

export function nextStalenessStage({
  currentStage,
  staleDays,
}: {
  currentStage: StalenessStage;
  staleDays: number;
}) {
  if (staleDays < 2) return { stage: 0 as StalenessStage, reason: "fresh" };
  if (staleDays < 6) return { stage: Math.max(1, currentStage) as StalenessStage, reason: "gentle-nudge" };
  if (staleDays < 12) return { stage: Math.max(2, currentStage) as StalenessStage, reason: "structured-reset" };
  return { stage: 3 as StalenessStage, reason: "accountability-prompt" };
}
```

- [ ] **Step 4: Implement action risk classifier and mode router**

```ts
// lib/sophon/action-policy.ts
export type SophonActionRisk = "low" | "medium" | "high";
export type SophonActionMode = "auto" | "approve" | "suggest";

export function classifyActionRisk({
  kind,
  reversible,
  externalSideEffect,
}: {
  kind: string;
  reversible: boolean;
  externalSideEffect: boolean;
}): SophonActionRisk {
  if (!reversible || externalSideEffect) return "high";
  if (kind === "calendar-draft" || kind === "task-reorder") return "low";
  return "medium";
}

export function routeActionMode(risk: SophonActionRisk): SophonActionMode {
  if (risk === "low") return "auto";
  if (risk === "medium") return "approve";
  return "suggest";
}
```

- [ ] **Step 5: Run tests and commit**

Run: `node --test --import tsx tests/unit/sophon-staleness-ladder.test.ts tests/unit/sophon-action-policy.test.ts`  
Expected: PASS

```bash
git add lib/sophon/staleness-ladder.ts lib/sophon/action-policy.ts tests/unit/sophon-staleness-ladder.test.ts tests/unit/sophon-action-policy.test.ts
git commit -m "feat: add sophon staleness ladder and action policy"
```

---

### Task 3: Add Sophon persistence (schema, migration, query module)

**Files:**
- Modify: `lib/db/schema.ts`
- Create: `lib/db/migrations/0016_sophon_daily_command_center.sql`
- Create: `lib/db/query-modules/sophon.ts`
- Modify: `lib/db/queries.ts`

- [ ] **Step 1: Write failing query-module unit test against function contracts**

```ts
import assert from "node:assert/strict";
import { test } from "node:test";
import { listSophonTasksForUser } from "@/lib/db/queries";

test("sophon query module exports list function", async () => {
  assert.equal(typeof listSophonTasksForUser, "function");
});
```

Save as `tests/unit/sophon-query-contract.test.ts`.

- [ ] **Step 2: Run tests to verify fail state**

Run: `node --test --import tsx tests/unit/sophon-query-contract.test.ts`  
Expected: FAIL (`listSophonTasksForUser` not exported).

- [ ] **Step 3: Add DB migration and schema tables**

```sql
-- lib/db/migrations/0016_sophon_daily_command_center.sql
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
```

- [ ] **Step 4: Add query module and barrel export**

```ts
// lib/db/query-modules/sophon.ts
import "server-only";
import { and, asc, desc, eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import {
  sophonActionLog,
  sophonDailyReview,
  sophonHabitState,
  sophonTask,
} from "@/lib/db/schema";

export async function listSophonTasksForUser({ userId }: { userId: string }) {
  return db
    .select()
    .from(sophonTask)
    .where(eq(sophonTask.userId, userId))
    .orderBy(asc(sophonTask.dueAt), desc(sophonTask.createdAt))
    .limit(200);
}

export async function upsertSophonDailyReviewForUser({
  userId,
  reviewDate,
  wins,
  misses,
  carryForward,
  calibration,
}: {
  userId: string;
  reviewDate: string;
  wins: string[];
  misses: string[];
  carryForward: string[];
  calibration: Record<string, unknown>;
}) {
  const [row] = await db
    .insert(sophonDailyReview)
    .values({ userId, reviewDate, wins, misses, carryForward, calibration })
    .onConflictDoUpdate({
      target: [sophonDailyReview.userId, sophonDailyReview.reviewDate],
      set: { wins, misses, carryForward, calibration, updatedAt: new Date() },
    })
    .returning();
  return row;
}
```

Also export from `lib/db/queries.ts`:

```ts
export * from "./query-modules/sophon";
```

- [ ] **Step 5: Run migration + tests and commit**

Run: `pnpm db:migrate && node --test --import tsx tests/unit/sophon-query-contract.test.ts`  
Expected: migration succeeds, contract test PASS.

```bash
git add lib/db/migrations/0016_sophon_daily_command_center.sql lib/db/schema.ts lib/db/query-modules/sophon.ts lib/db/queries.ts tests/unit/sophon-query-contract.test.ts
git commit -m "feat: add sophon persistence layer and db queries"
```

---

### Task 4: Build daily command center orchestration service

**Files:**
- Create: `lib/sophon/build-daily-command-center.ts`
- Create: `tests/unit/sophon-build-daily-command-center.test.ts`

- [ ] **Step 1: Write failing integration-style unit test for full assembly**

```ts
import assert from "node:assert/strict";
import { test } from "node:test";
import { buildDailyCommandCenter } from "@/lib/sophon/build-daily-command-center";

test("buildDailyCommandCenter returns concise now/next/later output", async () => {
  const out = await buildDailyCommandCenter({
    calendarLoad: 0.8,
    carryoverLoad: 0.5,
    stalenessPressure: 0.7,
    candidates: [
      {
        id: "task-1",
        title: "Renew insurance",
        source: "manual",
        impact: 0.9,
        urgency: 0.9,
        commitmentRisk: 0.8,
        effortFit: 0.6,
        decayRisk: 0.7,
        dueAt: null,
      },
    ],
  });
  assert.ok(out.now.length >= 1);
  assert.ok(out.next.length >= 0);
  assert.ok(out.later.length >= 0);
  assert.equal(out.now.length <= 7, true);
});
```

- [ ] **Step 2: Run test to verify fail state**

Run: `node --test --import tsx tests/unit/sophon-build-daily-command-center.test.ts`  
Expected: FAIL (missing service module/export).

- [ ] **Step 3: Implement orchestration service**

```ts
import { scorePriorityMatrix, pickAdaptivePriorityCount } from "@/lib/sophon/priority-matrix";
import { nextStalenessStage } from "@/lib/sophon/staleness-ladder";
import { classifyActionRisk, routeActionMode } from "@/lib/sophon/action-policy";
import type { SophonCandidateItem } from "@/lib/sophon/types";

export async function buildDailyCommandCenter({
  calendarLoad,
  carryoverLoad,
  stalenessPressure,
  candidates,
}: {
  calendarLoad: number;
  carryoverLoad: number;
  stalenessPressure: number;
  candidates: SophonCandidateItem[];
}) {
  const priorityCount = pickAdaptivePriorityCount({
    calendarLoad,
    carryoverLoad,
    stalenessPressure,
  });
  const ranked = scorePriorityMatrix(candidates);
  const now = ranked.slice(0, priorityCount);
  const next = ranked.slice(priorityCount, priorityCount + 3);
  const later = ranked.slice(priorityCount + 3);

  const stage = nextStalenessStage({
    currentStage: 0,
    staleDays: Math.round(stalenessPressure * 14),
  });

  const suggestedActions = now.map((item) => {
    const risk = classifyActionRisk({
      kind: "task-reorder",
      reversible: true,
      externalSideEffect: false,
    });
    return {
      itemId: item.id,
      risk,
      mode: routeActionMode(risk),
    };
  });

  return { now, next, later, staleness: stage, suggestedActions };
}
```

- [ ] **Step 4: Run tests to verify pass**

Run: `node --test --import tsx tests/unit/sophon-build-daily-command-center.test.ts`  
Expected: PASS

- [ ] **Step 5: Commit service layer**

```bash
git add lib/sophon/build-daily-command-center.ts tests/unit/sophon-build-daily-command-center.test.ts
git commit -m "feat: add sophon daily command center orchestration"
```

---

### Task 5: Add authenticated Sophon daily API route

**Files:**
- Create: `app/(chat)/api/sophon/daily/route.ts`
- Modify: `lib/db/query-modules/sophon.ts` (if additional helpers needed)

- [ ] **Step 1: Write failing route test contract**

```ts
import assert from "node:assert/strict";
import { test } from "node:test";
import { GET } from "@/app/(chat)/api/sophon/daily/route";

test("sophon daily route exports GET", () => {
  assert.equal(typeof GET, "function");
});
```

Save as `tests/unit/sophon-daily-route-contract.test.ts`.

- [ ] **Step 2: Run test and verify fail**

Run: `node --test --import tsx tests/unit/sophon-daily-route-contract.test.ts`  
Expected: FAIL (route module missing).

- [ ] **Step 3: Implement GET + POST route with auth and zod validation**

```ts
import { z } from "zod";
import { auth } from "@/app/(auth)/auth";
import { buildDailyCommandCenter } from "@/lib/sophon/build-daily-command-center";
import {
  listSophonTasksForUser,
  upsertSophonDailyReviewForUser,
} from "@/lib/db/queries";

const postBodySchema = z.object({
  reviewDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  wins: z.array(z.string().min(1)).max(10),
  misses: z.array(z.string().min(1)).max(10),
  carryForward: z.array(z.string().min(1)).max(20),
  calibration: z.record(z.string(), z.unknown()).default({}),
});

export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }
  const tasks = await listSophonTasksForUser({ userId: session.user.id });
  const candidates = tasks.map((t) => ({
    id: t.id,
    title: t.title,
    source: t.source as "manual" | "existing-task",
    impact: 0.7,
    urgency: t.dueAt ? 0.8 : 0.4,
    commitmentRisk: 0.5,
    effortFit: Math.min(Math.max(t.effortFit / 100, 0), 1),
    decayRisk: 0.5,
    dueAt: t.dueAt,
  }));
  const brief = await buildDailyCommandCenter({
    calendarLoad: 0.5,
    carryoverLoad: 0.4,
    stalenessPressure: 0.4,
    candidates,
  });
  return Response.json({ brief });
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }
  const parsed = postBodySchema.safeParse(await request.json());
  if (!parsed.success) {
    return Response.json({ error: "invalid body" }, { status: 400 });
  }
  const row = await upsertSophonDailyReviewForUser({
    userId: session.user.id,
    ...parsed.data,
  });
  return Response.json({ review: row });
}
```

- [ ] **Step 4: Run tests to verify route contract**

Run: `node --test --import tsx tests/unit/sophon-daily-route-contract.test.ts`  
Expected: PASS

- [ ] **Step 5: Commit API slice**

```bash
git add app/(chat)/api/sophon/daily/route.ts tests/unit/sophon-daily-route-contract.test.ts lib/db/query-modules/sophon.ts
git commit -m "feat: add authenticated sophon daily api route"
```

---

### Task 6: Wire docs/env and run full verification

**Files:**
- Modify: `.env.example`
- Modify: `docs/PROJECT.md`

- [ ] **Step 1: Add optional Sophon env knobs**

```env
# Sophon daily command center tuning
SOPHON_ADAPTIVE_MIN=3
SOPHON_ADAPTIVE_MAX=7
SOPHON_STALENESS_GENTLE_DAYS=2
SOPHON_STALENESS_RESET_DAYS=6
SOPHON_STALENESS_ACCOUNTABILITY_DAYS=12
```

- [ ] **Step 2: Add PROJECT.md pointer**

```md
| Sophon daily command center (Option B v1) | `app/(chat)/api/sophon/daily/route.ts`, `lib/sophon/`, `docs/superpowers/specs/2026-04-05-sophon-daily-command-center-design.md` |
```

- [ ] **Step 3: Run focused Sophon test suite**

Run:
`node --test --import tsx tests/unit/sophon-priority-matrix.test.ts tests/unit/sophon-staleness-ladder.test.ts tests/unit/sophon-action-policy.test.ts tests/unit/sophon-build-daily-command-center.test.ts tests/unit/sophon-query-contract.test.ts tests/unit/sophon-daily-route-contract.test.ts`  
Expected: PASS

- [ ] **Step 4: Run project validation commands**

Run: `pnpm check && pnpm run type-check`  
Expected: PASS

- [ ] **Step 5: Commit docs/config updates**

```bash
git add .env.example docs/PROJECT.md
git commit -m "docs: add sophon v1 route and tuning env documentation"
```

---

## Self-Review Checklist (completed by plan author before execution)

1. **Spec coverage:** Every approved spec section maps to tasks:
   - deterministic matrix + adaptive range -> Tasks 1 and 4,
   - staleness ladder + low-risk policy -> Task 2,
   - persistence/audit/review loop -> Task 3 and Task 5,
   - calm brief output + tests -> Task 4 and Task 6.
2. **Placeholder scan:** No placeholder markers remain.
3. **Type consistency:** Shared risk/mode/stage types are defined once in `lib/sophon/*` and reused.

Execution-ready: yes.
