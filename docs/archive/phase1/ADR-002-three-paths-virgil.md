# ADR-002: Three Paths, One Assistant — Virgil Implementation

**Date:** 2024-01-15  
**Status:** ACCEPTED  
**Project:** Virgil (TypeScript/Next.js)  
**Based on:** ADR-001 (reconciliation of async PA, cagent, Virgil principles)  

---

## Problem Statement

Virgil has strong foundations (local-first, user agency, honest SLAs) but the async/background job story is under-articulated:
- `BackgroundJob` table exists but no queue processor or API surface
- Night review runs are logged but proposals aren't stored/surfaced to user
- Nightly analysis → no explicit "Observe/Propose/Act" framework
- Long-running queries (multi-step analysis) have no explicit enqueue→poll UX

Result: Users don't know what's async, when to expect results, or what proposals are pending.

---

## Solution: Three Paths + Three Tiers (Virgil Edition)

### Three Execution Paths

#### 1. **Fast Path (Sync)**
- Chat, quick memory retrieval, verification lookups
- No LLM or short LLM with hard caps (2s timeout, max 256 tokens)
- SLA: Honest — return "I'm analyzing this..." rather than block
- **In Virgil:** Existing chat flow

#### 2. **Slow Path (Async)**
- Deep analysis, multi-step reports, goal synthesis
- Enqueue → user continues → poll `/api/jobs/{id}` → results ready
- Mental model: Same as cagent docs (explicit job_id, state machine)
- **In Virgil:** Extend `BackgroundJob` with proper API surface

#### 3. **Nightly / Scheduled Path**
- Batch analysis on fixed schedule (e.g., 2 AM user time)
- Analyze → Propose → (optional) Act with tiered automation
- **In Virgil:** Existing night review + new proposal surface

### Three Safety Tiers

#### Tier 1: Observe
- **What:** Read-only aggregation, insights, summaries, metrics
- **Storage:** Memory table (already exists)
- **Safety:** Never needs approval; always safe
- **Example:** "You asked 47 questions this week about fitness"

#### Tier 2: Propose
- **What:** Draft suggestions (memory rows, task templates, recommendations)
- **Storage:** Extend Memory table with `status: "proposed"` OR create `Proposal` table
- **Safety:** User sees all ideas before applying; requires explicit approval
- **Example:** "Consider tracking sleep? (stored as proposed memory)"

#### Tier 3: Act
- **What:** Mutate real state (create memory, send email, external calls)
- **Storage:** Audit log (Memory or new table)
- **Safety:** Only with explicit user rule OR one-tap approval; never silent for external comms
- **Example:** "Weekly summary emailed" (per user automation rule)

---

## Technical Architecture (Virgil)

### 1. Extend BackgroundJob Table

**Current:** `BackgroundJob` exists, minimal API surface  
**New:** Add columns for proposal tracking and SLA metrics

```typescript
// lib/db/schema.ts - extend BackgroundJob

export const backgroundJob = pgTable(
  "BackgroundJob",
  {
    // Existing columns
    id: uuid("id").primaryKey().notNull().defaultRandom(),
    userId: uuid("userId").notNull().references(() => user.id),
    kind: varchar("kind", { length: 64 }).notNull(),
    status: varchar("status", {
      enum: ["pending", "running", "completed", "failed", "cancelled"],
    }).notNull().default("pending"),
    input: jsonb("input").notNull().default({}),
    result: jsonb("result"),
    error: text("error"),
    createdAt: timestamp("createdAt").notNull().defaultNow(),
    updatedAt: timestamp("updatedAt").notNull().defaultNow(),
    startedAt: timestamp("startedAt"),
    completedAt: timestamp("completedAt"),
    
    // NEW: SLA tracking
    wallTimeMs: integer("wallTimeMs"),  // ms from start to completion
    retryCount: integer("retryCount").notNull().default(0),
    
    // NEW: Proposal tracking
    proposalCount: integer("proposalCount").notNull().default(0),
  },
  (table) => ({
    userCreatedIdx: index("BackgroundJob_userId_createdAt_idx").on(table.userId, table.createdAt),
    userStatusIdx: index("BackgroundJob_userId_status_idx").on(table.userId, table.status),
  })
);
```

### 2. Create JobAudit Table

Track state transitions for debugging and observability.

```typescript
export const backgroundJobAudit = pgTable(
  "BackgroundJobAudit",
  {
    id: uuid("id").primaryKey().notNull().defaultRandom(),
    jobId: uuid("jobId").notNull().references(() => backgroundJob.id, { onDelete: "cascade" }),
    userId: uuid("userId").notNull().references(() => user.id, { onDelete: "cascade" }),
    oldStatus: varchar("oldStatus").notNull(),
    newStatus: varchar("newStatus").notNull(),
    actor: varchar("actor").notNull(),  // "system" or user_id
    reason: text("reason"),
    createdAt: timestamp("createdAt").notNull().defaultNow(),
  },
  (table) => ({
    jobIdx: index("BackgroundJobAudit_jobId_idx").on(table.jobId),
  })
);
```

### 3. Extend Memory Table for Proposals

**Current:** Memory has `kind: "note" | "fact" | "goal" | "opportunity"`  
**New:** Add tier system

```typescript
// Modify memory table to support tiers:
export const memory = pgTable("Memory", {
  id: uuid("id").primaryKey().notNull().defaultRandom(),
  userId: uuid("userId").notNull().references(() => user.id),
  chatId: uuid("chatId").references(() => chat.id),
  kind: varchar("kind", { enum: ["note", "fact", "goal", "opportunity"] }).notNull().default("note"),
  
  // NEW: Tier system (observe/propose/act)
  tier: varchar("tier", { enum: ["observe", "propose", "act"] }).notNull().default("observe"),
  
  // NEW: Proposal metadata
  proposedAt: timestamp("proposedAt"),  // NULL unless tier="propose"
  approvedAt: timestamp("approvedAt"),  // NULL unless tier="propose" AND approved
  appliedAt: timestamp("appliedAt"),    // NULL unless executed
  
  content: text("content").notNull(),
  metadata: json("metadata").$type<Record<string, unknown>>().notNull().default({}),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
  updatedAt: timestamp("updatedAt").notNull().defaultNow(),
});
```

### 4. API Surface for Jobs

**Endpoints:**

```
POST /api/jobs
  - Create async job
  - Body: { kind: "goal_synthesis" | "fitness_analysis" | "spending_review", userId, input }
  - Return: { jobId, status: "pending", estimatedWaitMs: 30000 }

GET /api/jobs?userId={id}
  - List user's jobs
  - Return: [{ jobId, kind, status, createdAt, wallTimeMs, proposalCount }]

GET /api/jobs/{jobId}
  - Get job detail + audit trail + proposals
  - Return: { jobId, kind, status, input, result, proposals: [...], auditTrail: [...] }

POST /api/jobs/{jobId}/approve
  - Approve selected proposals
  - Body: { memoryIds: [id1, id2] }
  - Return: { jobId, approved: 2, appliedCount: 2 }

DELETE /api/jobs/{jobId}
  - Cancel pending job
  - Return: { jobId, status: "cancelled" }

GET /api/metrics/job-slas
  - Get SLA metrics per job kind
  - Return: { goal_synthesis: { p50: 2000, p95: 5000, p99: 8000, sampleCount: 248 } }
```

### 5. Queue Processor

Process background jobs asynchronously, with retry and state tracking.

```typescript
// lib/background-jobs/processor.ts

interface JobHandler {
  (job: BackgroundJob): Promise<{ success: boolean; data: any; error?: string }>;
}

const handlers: Record<string, JobHandler> = {
  "goal_synthesis": analyzeGoalsAsync,
  "fitness_analysis": analyzeFitnessAsync,
  "spending_review": analyzeSpendingAsync,
};

async function processQueue() {
  while (true) {
    // Get next pending job
    const job = await db.query.backgroundJob.findFirst({
      where: eq(backgroundJob.status, "pending"),
      orderBy: asc(backgroundJob.createdAt),
    });

    if (!job) {
      await sleep(100);
      continue;
    }

    // Check idempotency (nightly jobs only once per user per day)
    if (job.kind === "nightly_review") {
      const alreadyRan = await checkNightlyAlreadyRan(job.userId, job.createdAt);
      if (alreadyRan) {
        await updateJobStatus(job.id, "cancelled", "Nightly already ran today");
        continue;
      }
    }

    // Execute with retry
    const result = await executeWithRetry(job);
  }
}

async function executeWithRetry(job: BackgroundJob, maxRetries = 3) {
  const startTime = Date.now();

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      // Update status to running
      await updateJobStatus(job.id, "running", "Execution started");

      // Execute handler
      const handler = handlers[job.kind];
      if (!handler) throw new Error(`No handler for job kind: ${job.kind}`);
      
      const result = await handler(job);
      if (!result.success) throw new Error(result.error);

      // Success
      const wallTimeMs = Date.now() - startTime;
      await updateJobStatus(job.id, "completed", "Completed successfully", {
        wallTimeMs,
        result: result.data,
        proposalCount: countProposalsInResult(result.data),
      });

      return result;
    } catch (error) {
      if (attempt < maxRetries - 1) {
        // Retry with exponential backoff
        const waitMs = 2 ** (attempt + 1) * 1000;
        console.warn(`Job ${job.id} failed, retrying in ${waitMs}ms:`, error);
        await sleep(waitMs);
      } else {
        // Final failure
        const wallTimeMs = Date.now() - startTime;
        await updateJobStatus(job.id, "failed", error.message, { wallTimeMs });
        return { success: false, error: error.message };
      }
    }
  }
}
```

### 6. Nightly Analysis Refactor

```typescript
// lib/night-review/analyzer.ts

export async function runNightlyAnalysis(userId: string): Promise<{
  insights: Memory[];
  proposals: Memory[];
}> {
  // Analyze user data (read-only)
  const insights = await analyzeUserData(userId);
  
  // Create Insight memories (tier 1, observe-only)
  for (const insight of insights) {
    await db.insert(memory).values({
      id: crypto.randomUUID(),
      userId,
      kind: "fact",
      tier: "observe",
      content: insight.text,
      metadata: insight.data,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  }

  // Generate proposals (tier 2, needs approval)
  const proposals = await generateProposals(userId, insights);
  
  for (const proposal of proposals) {
    await db.insert(memory).values({
      id: crypto.randomUUID(),
      userId,
      kind: "opportunity",
      tier: "propose",
      content: proposal.text,
      metadata: proposal.data,
      proposedAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  }

  // DO NOT execute (Tier 3). Store proposals, let user approve.

  return { insights, proposals };
}
```

---

## Implementation Phases

### Phase 1: Jobs API + Tier 1 (Observe)
- Extend BackgroundJob schema
- Create JobAudit table
- Implement 5 API endpoints (POST, GET, GET/{id}, POST/{id}/approve, DELETE)
- Queue processor with retry logic
- Tier 1 (insights only, no execution)
- **Timeline:** 3-4 weeks

### Phase 2: Tier 2 (Propose) + Approval Flow
- Proposal storage (Memory tier="propose")
- UI to view/approve proposals
- POST /api/jobs/{id}/approve endpoint
- Email digest of pending proposals
- **Timeline:** 2 weeks

### Phase 3: Tier 3 (Act) + Automation Rules
- User rules (e.g., "auto-email weekly summary")
- Audit logging for mutations
- Undo/revert for important changes
- **Timeline:** 3 weeks

### Phases 4-5: Integrations + Dashboard
- External integrations (email, Slack, Google Calendar)
- Jobs dashboard with audit trails
- SLA metrics dashboard
- **Timeline:** 4 weeks

---

## Product Narrative

> "Fast when you're in the room, thorough when you're not—nothing important changes your goals or reaches external systems without a visible proposal or an explicit rule you turned on."

**Operationalized in Virgil:**
- **Fast:** Chat stays responsive; long analysis enqueues with honest "analyzing..." message
- **Thorough:** Nightly batch work surfaces insights + proposals in morning
- **Safe:** Proposals visible in UI; no silent external calls; audit trail for all mutations
- **User control:** Automation rules per domain with caps; one-tap approval for proposals

---

## Success Criteria (Phase 1)

✅ BackgroundJob + JobAudit tables created  
✅ 5 API endpoints working (POST, GET, GET/{id}, POST/{id}/approve, DELETE)  
✅ Queue processor handles job objects with retry + idempotency  
✅ Nightly analysis creates Insights (tier="observe")  
✅ Insights surfaced in UI (Memory list filtered by tier)  
✅ SLA metrics endpoint working  
✅ Full audit trail on state changes  
✅ TypeScript types complete (no `any`)  
✅ Tests passing (Jest + integration)  

---

## Key Differences from ADR-001

| Aspect | ADR-001 (Python PA) | ADR-002 (Virgil) |
|--------|-------------------|------------------|
| **Database** | SQLAlchemy ORM | Drizzle ORM |
| **API Framework** | FastAPI | Next.js API routes |
| **Job Table** | `Job` (new) | `BackgroundJob` (extend) |
| **Queue** | Async Python queue | Node.js worker or cron |
| **Memory/Proposals** | Separate tables | Single Memory table with tiers |
| **Night Review** | Nightly analyzer output | Existing night-review + proposals |
| **Testing** | pytest | Jest + Playwright |

---

## References

- ADR-001: Reconciliation of async PA, cagent, Virgil principles
- Virgil schema: `lib/db/schema.ts`
- Existing BackgroundJob: Already in schema
- Night review: `lib/night-review/`
- Agent tasks: `lib/agent-tasks/`

