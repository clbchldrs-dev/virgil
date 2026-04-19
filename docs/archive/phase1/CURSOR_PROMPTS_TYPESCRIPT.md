# Cursor Prompts for Virgil Phase 1 Implementation

Copy each prompt into Cursor. These are TypeScript/Drizzle/Next.js versions of the reconciliation blueprint.

---

## PROMPT 1: Extend BackgroundJob Schema + Create JobAudit

```
I'm implementing Phase 1 of ADR-002 (Three Paths, One Assistant for Virgil).

Current setup:
- lib/db/schema.ts has existing BackgroundJob table
- Using Drizzle ORM with PostgreSQL
- Next.js project (TypeScript)

I need to:

1. **Extend BackgroundJob table** in lib/db/schema.ts:
   - Add wallTimeMs: integer (milliseconds from start to completion)
   - Add retryCount: integer (default 0)
   - Add proposalCount: integer (default 0) - how many proposals this job generated

2. **Create new backgroundJobAudit table** in lib/db/schema.ts:
   - id: uuid, primaryKey, defaultRandom
   - jobId: uuid, FK to backgroundJob.id, onDelete cascade
   - userId: uuid, FK to user.id, onDelete cascade
   - oldStatus: varchar (e.g., "pending", "running")
   - newStatus: varchar (e.g., "running", "completed")
   - actor: varchar (e.g., "system" or user_id)
   - reason: text (optional, why the state changed)
   - createdAt: timestamp, default now
   - Index on jobId and createdAt for performance

3. **Extend memory table** with tier system (for proposals):
   - Add tier: varchar enum ["observe", "propose", "act"], default "observe"
   - Add proposedAt: timestamp (NULL unless tier="propose")
   - Add approvedAt: timestamp (NULL unless tier="propose" AND user approved)
   - Add appliedAt: timestamp (NULL unless executed)

After changes, verify:
- Can import: import { backgroundJob, backgroundJobAudit, memory } from "@/lib/db/schema"
- Run migrations to create tables
- Check types: InferSelectModel works for all 3 tables

Note: Keep existing columns in BackgroundJob and memory. Just add new ones.
```

---

## PROMPT 2: Create Job Queries Module

```
Create lib/db/query-modules/backgroundJobs.ts for type-safe queries.

This module exports async functions for all BackgroundJob operations:

```typescript
export async function createJob(
  userId: string,
  kind: string,
  input: Record<string, unknown>
): Promise<BackgroundJob> {
  // Create job in "pending" status
  // Return the created job
}

export async function getJob(jobId: string): Promise<BackgroundJob | null> {
  // Fetch by ID, return null if not found
}

export async function listUserJobs(
  userId: string,
  status?: string
): Promise<BackgroundJob[]> {
  // List all jobs for user
  // Filter by status if provided
  // Order by createdAt DESC
}

export async function updateJobStatus(
  jobId: string,
  newStatus: string,
  reason: string = "",
  updates?: { wallTimeMs?: number; result?: any; error?: string; proposalCount?: number }
): Promise<void> {
  // Update job status
  // Set updatedAt = now
  // If newStatus = "completed" or "failed", set completedAt = now
  // Log to backgroundJobAudit with reason
  // Update wallTimeMs, result, error, proposalCount if provided
}

export async function cancelJob(jobId: string): Promise<void> {
  // Only allowed if status = "pending"
  // Set status = "cancelled"
  // Log audit
}

export async function logJobAudit(
  jobId: string,
  userId: string,
  oldStatus: string,
  newStatus: string,
  actor: string = "system",
  reason: string = ""
): Promise<void> {
  // Create backgroundJobAudit row
  // timestamp = now
}

export async function getJobAuditTrail(jobId: string): Promise<Array<{
  oldStatus: string;
  newStatus: string;
  actor: string;
  reason: string | null;
  createdAt: Date;
}>> {
  // Fetch all audit rows for job
  // Order by createdAt ASC
  // Return as plain objects
}

export async function getJobMetrics(kind: string): Promise<{
  p50Ms: number;
  p95Ms: number;
  p99Ms: number;
  meanMs: number;
  sampleCount: number;
  successRate: number;
}> {
  // Query completed jobs of this kind
  // Calculate percentiles on wallTimeMs
  // Calculate success rate (completed / (completed + failed))
  // Return metrics
}
```

Patterns to use:
- db.query.backgroundJob.findFirst({ where: ... })
- db.query.backgroundJob.findMany({ where: ... })
- db.update(backgroundJob).set({...}).where(...)
- db.insert(backgroundJobAudit).values({...})

Use eq(), and(), desc() from drizzle-orm for query building.

Export all functions as async. Use prepared statements where possible.
```

---

## PROMPT 3: Create API Routes for Jobs

```
Create Next.js API routes in app/api/jobs/ for the job queue system.

Create these files:

1. **app/api/jobs/route.ts** (POST /api/jobs + GET /api/jobs):

POST /api/jobs:
  - Body: { kind: string, userId: string, input: Record<string, unknown> }
  - Call: createJob(userId, kind, input)
  - Return: { jobId: string, status: "pending", createdAt: Date, estimatedWaitMs: number }
  - Status: 200
  - On error: 400 (validation) or 500 (server)

GET /api/jobs:
  - Query: ?userId={id}&status={optional}
  - Call: listUserJobs(userId, status)
  - Return: { jobs: Array<{ jobId, kind, status, createdAt, wallTimeMs, proposalCount }> }
  - Status: 200

2. **app/api/jobs/[jobId]/route.ts** (GET + DELETE):

GET /api/jobs/[jobId]:
  - Fetch job by ID
  - Fetch audit trail
  - Return: { job: BackgroundJob, auditTrail: [...], proposals?: Memory[] }
  - Status: 200 or 404

DELETE /api/jobs/[jobId]:
  - Only allowed if status = "pending"
  - Call: cancelJob(jobId)
  - Return: { jobId, status: "cancelled" }
  - Status: 200 or 409 (if not pending)

3. **app/api/jobs/[jobId]/approve/route.ts** (POST):

POST /api/jobs/[jobId]/approve:
  - Body: { memoryIds: string[] }
  - Job must be status = "completed"
  - For each memoryId: update Memory set approvedAt = now
  - Update job status to "approving"
  - Return: { jobId, approvedCount: number, appliedCount: number }
  - Status: 200 or 409 (if not completed)

4. **app/api/metrics/job-slas/route.ts** (GET):

GET /api/metrics/job-slas:
  - Optional query: ?kind={specific_kind}
  - For each job kind (or specific kind):
    - Call getJobMetrics(kind)
    - Return: { [kind]: { p50Ms, p95Ms, p99Ms, meanMs, sampleCount, successRate } }
  - Status: 200

Patterns:
- Use NextRequest, NextResponse from next/server
- Validate input with zod if available, else manual checks
- Catch errors and return 500 with error message
- Use error logs for debugging
- All async functions, proper error handling

Import functions from lib/db/query-modules/backgroundJobs.ts
```

---

## PROMPT 4: Create Job Processor (Queue Worker)

```
Create lib/background-jobs/processor.ts - the async queue processor.

This runs jobs from BackgroundJob table with retry logic and state tracking.

```typescript
import { db } from "@/lib/db/client";
import { backgroundJob } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

interface JobHandlerResult {
  success: boolean;
  data?: Record<string, unknown>;
  proposalCount?: number;
  error?: string;
}

// Job handlers (will implement these separately)
const handlers: Record<string, (job: BackgroundJob) => Promise<JobHandlerResult>> = {
  "goal_synthesis": analyzeGoalsAsync,
  "fitness_analysis": analyzeFitnessAsync,
  "spending_review": analyzeSpendingAsync,
};

export async function processQueue() {
  console.log("Job processor started");

  while (true) {
    try {
      // Get next pending job
      const pendingJob = await db.query.backgroundJob.findFirst({
        where: eq(backgroundJob.status, "pending"),
        orderBy: (job) => asc(job.createdAt),
      });

      if (!pendingJob) {
        // No jobs, wait and retry
        await new Promise((resolve) => setTimeout(resolve, 100));
        continue;
      }

      // Check idempotency: nightly jobs only once per user per day
      if (pendingJob.kind === "nightly_review") {
        const alreadyRan = await checkNightlyAlreadyRan(
          pendingJob.userId,
          pendingJob.createdAt
        );
        if (alreadyRan) {
          await updateJobStatus(
            pendingJob.id,
            "cancelled",
            "Nightly already ran today"
          );
          continue;
        }
      }

      // Execute with retry
      await executeWithRetry(pendingJob);
    } catch (error) {
      console.error("Queue processor error:", error);
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  }
}

async function executeWithRetry(job: BackgroundJob, maxRetries = 3) {
  const startTime = Date.now();

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      // Mark as running
      await updateJobStatus(job.id, "running", "Execution started");

      // Get handler
      const handler = handlers[job.kind];
      if (!handler) {
        throw new Error(`No handler for job kind: ${job.kind}`);
      }

      // Execute
      const result = await handler(job);
      if (!result.success) {
        throw new Error(result.error || "Handler returned failure");
      }

      // Success
      const wallTimeMs = Date.now() - startTime;
      await updateJobStatus(job.id, "completed", "Completed successfully", {
        wallTimeMs,
        result: result.data,
        proposalCount: result.proposalCount,
      });

      return;
    } catch (error) {
      if (attempt < maxRetries - 1) {
        // Retry with exponential backoff
        const waitMs = Math.pow(2, attempt + 1) * 1000;
        console.warn(
          `Job ${job.id} failed (attempt ${attempt + 1}), retrying in ${waitMs}ms:`,
          error
        );
        await new Promise((resolve) => setTimeout(resolve, waitMs));
      } else {
        // Final failure
        const wallTimeMs = Date.now() - startTime;
        await updateJobStatus(job.id, "failed", String(error), {
          wallTimeMs,
        });
        console.error(`Job ${job.id} failed after ${maxRetries} attempts:`, error);
      }
    }
  }
}

async function checkNightlyAlreadyRan(
  userId: string,
  jobCreatedAt: Date
): Promise<boolean> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const completedNightly = await db.query.backgroundJob.findFirst({
    where: and(
      eq(backgroundJob.userId, userId),
      eq(backgroundJob.kind, "nightly_review"),
      gte(backgroundJob.createdAt, today),
      eq(backgroundJob.status, "completed")
    ),
  });

  return !!completedNightly;
}

// Import updateJobStatus from lib/db/query-modules/backgroundJobs.ts
import { updateJobStatus } from "@/lib/db/query-modules/backgroundJobs";
```

Handlers (stubs for now, will be real in Phase 2):

```typescript
async function analyzeGoalsAsync(job: BackgroundJob): Promise<JobHandlerResult> {
  // Stub: Sleep 2 seconds, return mock data
  await new Promise((resolve) => setTimeout(resolve, 2000));
  return {
    success: true,
    data: { insights: ["You have 3 active goals"] },
    proposalCount: 1,
  };
}

async function analyzeFitnessAsync(job: BackgroundJob): Promise<JobHandlerResult> {
  // Stub: Sleep 15 seconds, return mock data
  await new Promise((resolve) => setTimeout(resolve, 15000));
  return {
    success: true,
    data: { insights: ["47 min cardio this week"] },
    proposalCount: 2,
  };
}

async function analyzeSpendingAsync(job: BackgroundJob): Promise<JobHandlerResult> {
  // Stub: Sleep 20 seconds, return mock data
  await new Promise((resolve) => setTimeout(resolve, 20000));
  return {
    success: true,
    data: { insights: ["$450 on groceries this month"] },
    proposalCount: 1,
  };
}
```

Export processQueue function. It will be called from a background job runner (worker thread, cron, or vercel cron).
```

---

## PROMPT 5: Create Job Handler Stubs

```
Create lib/background-jobs/handlers.ts with actual job handler implementations (stubs for Phase 1).

Each handler:
- Takes BackgroundJob as input
- Returns { success, data, proposalCount, error }
- For Phase 1, these are stubs that sleep and return mock data
- Phase 2 will implement real logic (query database, analyze, generate proposals)

```typescript
import { BackgroundJob } from "@/lib/db/schema";

export interface JobHandlerResult {
  success: boolean;
  data?: Record<string, unknown>;
  proposalCount?: number;
  error?: string;
}

export async function analyzeGoalsAsync(
  job: BackgroundJob
): Promise<JobHandlerResult> {
  /**
   * Stub: Analyze user's goals and generate proposals
   * 
   * Real Phase 2 logic:
   * - Query Memory for goals (tier="goal")
   * - Query Chat for recent context
   * - Generate insights on goal progress
   * - Create proposal memories (tier="propose")
   * 
   * For now: Sleep and return mock data
   */
  await new Promise((resolve) => setTimeout(resolve, 2000));

  return {
    success: true,
    data: {
      insights: [
        "You have 3 active goals tracked",
        "Early retirement goal: 32% to target",
        "Fitness goal: 45% weekly progress",
      ],
      summaryText:
        "Goals are on track. Keep consistent with workouts and savings.",
    },
    proposalCount: 1, // "Consider tracking sleep quality?"
  };
}

export async function analyzeFitnessAsync(
  job: BackgroundJob
): Promise<JobHandlerResult> {
  /**
   * Stub: Analyze fitness patterns and generate workout proposals
   * 
   * Real Phase 2 logic:
   * - Query user's workout history
   * - Detect patterns (best days, intensity distribution, gaps)
   * - Suggest workout routines
   * 
   * For now: Sleep and return mock data
   */
  await new Promise((resolve) => setTimeout(resolve, 15000));

  return {
    success: true,
    data: {
      insights: [
        "You exercised 267 minutes this month (89% of 300-min goal)",
        "Most active: Thursdays (52 min avg)",
        "Least active: Sundays (0 min) - gap identified",
        "High intensity: 22% of workouts (target: 30%)",
      ],
      weeklyStats: {
        totalMinutes: 267,
        sessionCount: 12,
        avgSessionLength: 22,
      },
    },
    proposalCount: 2, // "Add Sunday yoga?" + "Increase high-intensity days?"
  };
}

export async function analyzeSpendingAsync(
  job: BackgroundJob
): Promise<JobHandlerResult> {
  /**
   * Stub: Analyze spending patterns and generate budget proposals
   * 
   * Real Phase 2 logic:
   * - Query financial logs/transactions
   * - Detect spending trends
   * - Compare to budgets/goals
   * - Suggest cost reductions
   * 
   * For now: Sleep and return mock data
   */
  await new Promise((resolve) => setTimeout(resolve, 20000));

  return {
    success: true,
    data: {
      insights: [
        "$2,450 spent this month",
        "Groceries: $450 (18% of spending) - up 15% from average",
        "Dining out: $320 (13% of spending) - up 8% from average",
        "Early retirement savings on track: +$2,000 to target",
      ],
      monthlyStats: {
        totalSpent: 2450,
        income: 5000,
        savings: 2000,
        savingsRate: 0.4,
      },
    },
    proposalCount: 2, // "Compare 3 grocery stores?" + "Reduce dining out?"
  };
}

export async function nightlyReviewAsync(
  job: BackgroundJob
): Promise<JobHandlerResult> {
  /**
   * Stub: Run full nightly review combining all analyses
   * 
   * Orchestrates:
   * 1. Fitness analysis
   * 2. Spending analysis
   * 3. Goal analysis
   * 4. Generate combined proposals
   * 
   * Phase 2: Calls actual analyzers and creates Memory rows
   */
  await new Promise((resolve) => setTimeout(resolve, 45000));

  // Combined results
  const fitnessResult = await analyzeFitnessAsync(job);
  const spendingResult = await analyzeSpendingAsync(job);
  const goalsResult = await analyzeGoalsAsync(job);

  const totalProposals =
    (fitnessResult.proposalCount || 0) +
    (spendingResult.proposalCount || 0) +
    (goalsResult.proposalCount || 0);

  return {
    success: true,
    data: {
      timestamp: new Date().toISOString(),
      analysisRan: {
        fitness: true,
        spending: true,
        goals: true,
      },
      insights: [
        ...(fitnessResult.data?.insights || []),
        ...(spendingResult.data?.insights || []),
        ...(goalsResult.data?.insights || []),
      ],
    },
    proposalCount: totalProposals,
  };
}

// Export all handlers
export const handlers: Record<
  string,
  (job: BackgroundJob) => Promise<JobHandlerResult>
> = {
  goal_synthesis: analyzeGoalsAsync,
  fitness_analysis: analyzeFitnessAsync,
  spending_review: analyzeSpendingAsync,
  nightly_review: nightlyReviewAsync,
};
```

These are stubs for Phase 1. Real analysis logic comes in Phase 2 when we have actual data queries.
```

---

## PROMPT 6: Create Jest Tests for Jobs API

```
Create tests/api/jobs.test.ts with Jest unit tests for the Jobs API.

Use:
- jest and @testing-library/react for mocking
- Mock db functions from lib/db/query-modules/backgroundJobs
- Test each endpoint

```typescript
import { POST, GET, DELETE } from "@/app/api/jobs/route";
import { POST as postApprove } from "@/app/api/jobs/[jobId]/approve/route";
import { GET as getMetrics } from "@/app/api/metrics/job-slas/route";

// Mock db
jest.mock("@/lib/db/client", () => ({
  db: {
    query: {
      backgroundJob: {
        findFirst: jest.fn(),
        findMany: jest.fn(),
      },
    },
  },
}));

jest.mock("@/lib/db/query-modules/backgroundJobs", () => ({
  createJob: jest.fn(),
  getJob: jest.fn(),
  listUserJobs: jest.fn(),
  updateJobStatus: jest.fn(),
  cancelJob: jest.fn(),
  getJobAuditTrail: jest.fn(),
  getJobMetrics: jest.fn(),
}));

describe("Jobs API", () => {
  const mockUserId = "user-123";
  const mockJobId = "job-456";

  test("POST /api/jobs creates a job", async () => {
    const request = new Request("http://localhost:3000/api/jobs", {
      method: "POST",
      body: JSON.stringify({
        kind: "goal_synthesis",
        userId: mockUserId,
        input: { days: 30 },
      }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toHaveProperty("jobId");
    expect(data).toHaveProperty("status", "pending");
  });

  test("POST /api/jobs validates required fields", async () => {
    const request = new Request("http://localhost:3000/api/jobs", {
      method: "POST",
      body: JSON.stringify({
        kind: "goal_synthesis",
        // Missing userId and input
      }),
    });

    const response = await POST(request);
    expect(response.status).toBe(400);
  });

  test("GET /api/jobs lists user's jobs", async () => {
    const request = new Request(
      `http://localhost:3000/api/jobs?userId=${mockUserId}`,
      { method: "GET" }
    );

    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(Array.isArray(data.jobs)).toBe(true);
  });

  test("DELETE /api/jobs/[jobId] cancels a job", async () => {
    const request = new Request(
      `http://localhost:3000/api/jobs/${mockJobId}`,
      { method: "DELETE" }
    );

    const response = await DELETE(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toHaveProperty("status", "cancelled");
  });

  test("POST /api/jobs/[jobId]/approve approves proposals", async () => {
    const request = new Request(
      `http://localhost:3000/api/jobs/${mockJobId}/approve`,
      {
        method: "POST",
        body: JSON.stringify({
          memoryIds: ["mem-1", "mem-2"],
        }),
      }
    );

    const response = await postApprove(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toHaveProperty("approvedCount");
  });

  test("GET /api/metrics/job-slas returns SLA metrics", async () => {
    const request = new Request(
      "http://localhost:3000/api/metrics/job-slas",
      { method: "GET" }
    );

    const response = await getMetrics(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toHaveProperty("goal_synthesis");
    expect(data.goal_synthesis).toHaveProperty("p50Ms");
  });
});
```

Run with: `npm test tests/api/jobs.test.ts`

Focus on testing happy paths first. Phase 2 adds edge case tests.
```

---

## PROMPT 7: Extend Night Review to Create Proposals

```
Modify lib/night-review/index.ts to use new tier system.

Current: Night review logs metrics, no user-facing proposals  
New: Night review creates Memory rows (tier="observe" for insights, tier="propose" for suggestions)

```typescript
import { db } from "@/lib/db/client";
import { memory } from "@/lib/db/schema";
import type { BackgroundJob } from "@/lib/db/schema";

export async function runNightlyReview(userId: string): Promise<{
  insightsCount: number;
  proposalsCount: number;
}> {
  /**
   * Phase 1: Analyze user data and create Insight + Proposal memories.
   * Does NOT execute or mutate real state (that's Phase 3).
   * 
   * Flow:
   * 1. Query user's recent chats/memories/data
   * 2. Analyze patterns (fitness, spending, goals)
   * 3. Create Insight memories (tier="observe", always safe)
   * 4. Create Proposal memories (tier="propose", needs user approval)
   * 5. Return counts
   */

  try {
    // Analyze user data
    const insights = await analyzeUserData(userId);
    const proposals = await generateProposals(userId, insights);

    // Store insights (Tier 1: Observe)
    for (const insight of insights) {
      await db.insert(memory).values({
        id: crypto.randomUUID(),
        userId,
        kind: "fact",
        tier: "observe",
        content: insight.text,
        metadata: insight.data || {},
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    }

    // Store proposals (Tier 2: Propose)
    for (const proposal of proposals) {
      await db.insert(memory).values({
        id: crypto.randomUUID(),
        userId,
        kind: "opportunity",
        tier: "propose",
        content: proposal.text,
        metadata: proposal.data || {},
        proposedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    }

    return {
      insightsCount: insights.length,
      proposalsCount: proposals.length,
    };
  } catch (error) {
    console.error("Night review failed:", error);
    throw error;
  }
}

async function analyzeUserData(
  userId: string
): Promise<Array<{ text: string; data: Record<string, unknown> }>> {
  /**
   * Stub: Query user's data and generate insights.
   * 
   * Real Phase 2 logic:
   * - Query Memory table for recent notes, goals
   * - Query Chat for recent conversations
   * - Aggregate stats (workouts, spending, progress)
   * - Generate readable insights
   * 
   * For now: Return mock insights
   */

  return [
    {
      text: "You exercised 267 minutes this month (89% of goal)",
      data: { category: "fitness", minutes: 267, goal: 300 },
    },
    {
      text: "Spending is on track with early retirement goals",
      data: { category: "finance", status: "on_track" },
    },
    {
      text: "You asked 47 questions this week about goal-setting",
      data: { category: "engagement", questions: 47 },
    },
  ];
}

async function generateProposals(
  userId: string,
  insights: Array<{ text: string; data: Record<string, unknown> }>
): Promise<Array<{ text: string; data: Record<string, unknown> }>> {
  /**
   * Stub: Based on insights, generate proposals for user approval.
   * 
   * Real Phase 2 logic:
   * - For each insight, suggest an action
   * - E.g., "No Sunday workouts" → "Try light yoga Sunday?"
   * - Check user preferences (automation rules)
   * - Return proposal list
   * 
   * For now: Return mock proposals
   */

  const proposals: Array<{ text: string; data: Record<string, unknown> }> = [];

  // For each insight, generate a proposal
  for (const insight of insights) {
    if (insight.data.category === "fitness" && insight.data.minutes < 300) {
      proposals.push({
        text: "You're 13% short of your fitness goal. Consider adding a 20-min workout on Sunday?",
        data: {
          type: "suggest_routine",
          day: "Sunday",
          duration: 20,
          activity: "yoga",
        },
      });
    }

    if (insight.data.category === "finance") {
      proposals.push({
        text: "Your savings rate is great. Review your top 3 spending categories to optimize further?",
        data: {
          type: "deep_analysis",
          target: "spending_categories",
        },
      });
    }
  }

  return proposals;
}

// Export for jobs API to call
export { runNightlyReview };
```

This creates Memory rows with tier="observe" (insights) and tier="propose" (proposals).
Users can see these in the UI and approve proposals in Phase 2.

Phase 3 will add automation rules and execution logic.
```

---

## PROMPT 8: Add Job SLA Metrics Dashboard Endpoint

```
Create or extend app/api/metrics/job-slas/route.ts to return SLA metrics.

Endpoint: GET /api/metrics/job-slas?kind={optional}

Returns SLA data per job kind:
- p50Ms, p95Ms, p99Ms (percentiles of wall time)
- meanMs (average wall time)
- sampleCount (number of completed jobs)
- successRate (% completed successfully)

```typescript
import { NextRequest, NextResponse } from "next/server";
import { getJobMetrics } from "@/lib/db/query-modules/backgroundJobs";

const DEVICE_PROFILE = process.env.DEVICE_PROFILE || "Local";
const JOB_KINDS = ["goal_synthesis", "fitness_analysis", "spending_review", "nightly_review"];

export async function GET(request: NextRequest) {
  try {
    // Optional query param: ?kind=goal_synthesis
    const kind = request.nextUrl.searchParams.get("kind");

    const results: Record<string, any> = {};

    const kinds = kind ? [kind] : JOB_KINDS;

    for (const jobKind of kinds) {
      try {
        const metrics = await getJobMetrics(jobKind);
        results[jobKind] = {
          wallTimeMs: {
            p50: metrics.p50Ms,
            p95: metrics.p95Ms,
            p99: metrics.p99Ms,
            mean: metrics.meanMs,
          },
          sampleCount: metrics.sampleCount,
          successRate: metrics.successRate,
          deviceProfile: DEVICE_PROFILE,
          lastUpdated: new Date().toISOString(),
        };
      } catch (error) {
        // If metrics not available, return placeholder
        results[jobKind] = {
          wallTimeMs: { p50: 0, p95: 0, p99: 0, mean: 0 },
          sampleCount: 0,
          successRate: 1.0,
          deviceProfile: DEVICE_PROFILE,
          note: "Insufficient data",
        };
      }
    }

    return NextResponse.json(results, { status: 200 });
  } catch (error) {
    console.error("Error fetching job SLAs:", error);
    return NextResponse.json(
      { error: "Failed to fetch SLA metrics" },
      { status: 500 }
    );
  }
}
```

This enables:
- `curl http://localhost:3000/api/metrics/job-slas`
- `curl http://localhost:3000/api/metrics/job-slas?kind=goal_synthesis`

Returns realistic SLA data for monitoring job performance.
```

---

## How to Use These Prompts with Cursor

1. **Copy entire PROMPT X section** (all triple backticks)
2. **Paste into Cursor chat**
3. **Provide minimal context:** "I'm in the Virgil repo (/Users/caleb/Documents/virgil)"
4. **Let Cursor generate code**
5. **Review and adjust** if needed
6. **Test immediately** with provided commands

---

## Order to Execute

1. PROMPT 1: Database schema changes
2. PROMPT 2: Query module functions
3. PROMPT 3: API routes
4. PROMPT 4: Job processor
5. PROMPT 5: Job handlers
6. PROMPT 6: Jest tests
7. PROMPT 7: Night review integration
8. PROMPT 8: SLA metrics endpoint

---

## Testing Commands (After Each Prompt)

```bash
# Prompt 1: Verify schema
npx drizzle-kit push  # Apply migrations

# Prompt 2: Verify queries
npm run type-check

# Prompt 3: Verify API routes
npm run dev  # Start server
curl -X POST http://localhost:3000/api/jobs -H "Content-Type: application/json" -d '{"kind":"goal_synthesis","userId":"test","input":{}}'

# Prompt 6: Run tests
npm test tests/api/jobs.test.ts

# Prompt 8: Check metrics
curl http://localhost:3000/api/metrics/job-slas
```

---

## Success Criteria (End of Phase 1)

✅ BackgroundJob + JobAudit tables created  
✅ Memory table has tier column  
✅ 5 API routes working (POST, GET, GET/{id}, POST/{id}/approve, DELETE)  
✅ Job processor handles async execution with retry  
✅ Night review creates Insights (tier="observe") + Proposals (tier="propose")  
✅ Jest tests passing  
✅ SLA metrics endpoint returning data  
✅ Cursor used for all implementation  

---

**Ready? Start with PROMPT 1 and follow the order.**
