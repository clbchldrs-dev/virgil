# Phase 1 Implementation Checklists

Use these to track progress through all 8 sessions and 4 weeks.

---

## Pre-Implementation (This Week)

- [ ] Read `docs/ADR-002-three-paths-virgil.md` (15 min)
- [ ] Skim `VIRGIL_PHASE1_SETUP.md` (10 min)
- [ ] Review `docs/CURSOR_PROMPTS_TYPESCRIPT.md` sections 1-2 (5 min)
- [ ] Verify repo state: `npm run type-check` (should pass)
- [ ] Verify database: `echo $DATABASE_URL` (should be set)
- [ ] Open Cursor and test it works

**By end of week:** Ready to start Session 1

---

## Week 1: Database Layer

### Session 1: Extend BackgroundJob Schema

**Before:**
- [ ] Read PROMPT 1 carefully
- [ ] Understand what columns are being added:
  - BackgroundJob: wallTimeMs, retryCount, proposalCount
  - BackgroundJobAudit: new table for audit trail
  - Memory: tier, proposedAt, approvedAt, appliedAt

**During:**
- [ ] Open Cursor
- [ ] Paste PROMPT 1
- [ ] Review generated code
- [ ] Verify schema changes look correct

**After:**
- [ ] Run: `npx drizzle-kit push`
- [ ] Run: `npm run type-check`
- [ ] Both should succeed
- [ ] Commit: `git add lib/db/schema.ts && git commit -m "Phase 1: Extend BackgroundJob, create JobAudit, extend Memory"`

**Success Criteria:**
- [ ] `npx drizzle-kit push` succeeds
- [ ] `npm run type-check` has no errors
- [ ] New tables/columns in database

**Time: 30 min**

---

### Session 2: Create Query Module

**Before:**
- [ ] Read PROMPT 2 carefully
- [ ] Understand 7 functions: createJob, getJob, listUserJobs, updateJobStatus, cancelJob, logJobAudit, getJobAuditTrail, getJobMetrics
- [ ] Look at existing `lib/db/query-modules/` to understand pattern

**During:**
- [ ] Open Cursor
- [ ] Paste PROMPT 2
- [ ] Review generated code (should match prompt exactly)
- [ ] Check for proper Drizzle ORM usage

**After:**
- [ ] Create file: `lib/db/query-modules/backgroundJobs.ts`
- [ ] Run: `npm run type-check`
- [ ] Should have no errors
- [ ] Commit: `git add lib/db/query-modules/backgroundJobs.ts && git commit -m "Phase 1: Add background job query functions"`

**Success Criteria:**
- [ ] File created: `lib/db/query-modules/backgroundJobs.ts`
- [ ] All 7+ functions implemented
- [ ] `npm run type-check` passes
- [ ] Can import: `import { createJob } from "@/lib/db/query-modules/backgroundJobs"`

**Time: 45 min**

---

## Week 1 Checkpoint (Friday EOD)

- [ ] Session 1 complete (schema)
- [ ] Session 2 complete (queries)
- [ ] Both `npx drizzle-kit push` and `npm run type-check` passing
- [ ] Database schema correct: `BackgroundJob`, `BackgroundJobAudit`, `Memory` with new columns
- [ ] Query module created with all functions

**If not done:** Extend by 1-2 days, don't skip ahead.

---

## Week 2: API Layer

### Session 3: Create API Routes

**Before:**
- [ ] Read PROMPT 3 carefully
- [ ] Understand 5 routes:
  - POST /api/jobs (create)
  - GET /api/jobs (list)
  - GET /api/jobs/{id} (detail)
  - DELETE /api/jobs/{id} (cancel)
  - POST /api/jobs/{id}/approve (proposals)
  - GET /api/metrics/job-slas (metrics)

**During:**
- [ ] Open Cursor
- [ ] Paste PROMPT 3
- [ ] Review generated code
- [ ] Ensure imports are correct

**After:**
- [ ] Create files:
  - [ ] `app/api/jobs/route.ts`
  - [ ] `app/api/jobs/[jobId]/route.ts`
  - [ ] `app/api/jobs/[jobId]/approve/route.ts`
  - [ ] `app/api/metrics/job-slas/route.ts`
- [ ] Run: `npm run type-check`
- [ ] Start dev server: `npm run dev`
- [ ] Test manually:
  ```bash
  curl -X POST http://localhost:3000/api/jobs \
    -H "Content-Type: application/json" \
    -d '{"kind":"goal_synthesis","userId":"test","input":{}}'
  # Should return jobId and status
  ```
- [ ] Commit: `git add app/api/jobs && git commit -m "Phase 1: Add jobs API endpoints"`

**Success Criteria:**
- [ ] All 4 files created
- [ ] `npm run type-check` passes
- [ ] Dev server starts: `npm run dev`
- [ ] POST /api/jobs returns 200 with jobId
- [ ] GET /api/jobs returns 200 with array

**Time: 1 hour**

---

### Session 4: Create Queue Processor

**Before:**
- [ ] Read PROMPT 4 carefully
- [ ] Understand:
  - processQueue() main loop
  - executeWithRetry() with exponential backoff
  - checkNightlyAlreadyRan() idempotency
  - Stub handlers

**During:**
- [ ] Open Cursor
- [ ] Paste PROMPT 4
- [ ] Review generated code
- [ ] Check error handling

**After:**
- [ ] Create file: `lib/background-jobs/processor.ts`
- [ ] Run: `npm run type-check`
- [ ] Manual test (can run in node):
  ```bash
  node -e "
  const { processQueue } = require('./lib/background-jobs/processor');
  // Just verify it doesn't error on import
  console.log('Processor imports OK');
  "
  ```
- [ ] Commit: `git add lib/background-jobs/processor.ts && git commit -m "Phase 1: Add async job processor with retry logic"`

**Success Criteria:**
- [ ] File created: `lib/background-jobs/processor.ts`
- [ ] `npm run type-check` passes
- [ ] processQueue(), executeWithRetry() implemented
- [ ] Retry logic with exponential backoff
- [ ] Idempotency check for nightly

**Time: 1.5 hours**

---

## Week 2 Checkpoint (Friday EOD)

- [ ] Session 3 complete (API routes)
- [ ] Session 4 complete (processor)
- [ ] All endpoints responding (POST, GET, DELETE, etc.)
- [ ] Dev server runs without errors
- [ ] Manual API tests working

**If not done:** Extend by 1-2 days.

---

## Week 3: Handlers & Testing

### Session 5: Create Job Handlers

**Before:**
- [ ] Read PROMPT 5 carefully
- [ ] Understand:
  - analyzeGoalsAsync()
  - analyzeFitnessAsync()
  - analyzeSpendingAsync()
  - nightlyReviewAsync()
  - All return { success, data, proposalCount, error }

**During:**
- [ ] Open Cursor
- [ ] Paste PROMPT 5
- [ ] Review stub implementations

**After:**
- [ ] Create file: `lib/background-jobs/handlers.ts`
- [ ] Run: `npm run type-check`
- [ ] All stubs should exist and have proper types
- [ ] Commit: `git add lib/background-jobs/handlers.ts && git commit -m "Phase 1: Add stub job handlers"`

**Success Criteria:**
- [ ] File created: `lib/background-jobs/handlers.ts`
- [ ] 4 handler functions implemented
- [ ] Each returns proper type
- [ ] `npm run type-check` passes

**Time: 30 min**

---

### Session 6: Create Jest Tests

**Before:**
- [ ] Read PROMPT 6 carefully
- [ ] Understand test structure:
  - Mock db functions
  - Test each endpoint
  - Test validation

**During:**
- [ ] Open Cursor
- [ ] Paste PROMPT 6
- [ ] Review test code

**After:**
- [ ] Create file: `tests/api/jobs.test.ts`
- [ ] Run: `npm test tests/api/jobs.test.ts`
- [ ] All tests should pass (or report clearly)
- [ ] Commit: `git add tests/api/jobs.test.ts && git commit -m "Phase 1: Add Jest tests for jobs API"`

**Success Criteria:**
- [ ] File created: `tests/api/jobs.test.ts`
- [ ] 6+ tests defined
- [ ] Tests run: `npm test tests/api/jobs.test.ts`
- [ ] All tests pass or issues are clear

**Time: 1 hour**

---

## Week 3 Checkpoint (Friday EOD)

- [ ] Session 5 complete (handlers)
- [ ] Session 6 complete (tests)
- [ ] Jest tests passing
- [ ] All handlers have proper types
- [ ] `npm run type-check` passes

---

## Week 4: Integration

### Session 7: Extend Night Review

**Before:**
- [ ] Read PROMPT 7 carefully
- [ ] Understand:
  - runNightlyReview() creates Memory rows
  - Insights: tier="observe"
  - Proposals: tier="propose"
  - analyzeUserData() stub
  - generateProposals() stub

**During:**
- [ ] Open Cursor
- [ ] Paste PROMPT 7
- [ ] Review how it creates Memory rows

**After:**
- [ ] Modify: `lib/night-review/index.ts`
- [ ] Run: `npm run type-check`
- [ ] Manual test (if possible):
  ```bash
  node -e "
  const { runNightlyReview } = require('./lib/night-review');
  runNightlyReview('test-user').then(r => console.log(r));
  // Should return { insightsCount, proposalsCount }
  "
  ```
- [ ] Commit: `git add lib/night-review/index.ts && git commit -m "Phase 1: Integrate night review with tier system"`

**Success Criteria:**
- [ ] `lib/night-review/index.ts` modified
- [ ] Creates Memory rows with tier="observe" for insights
- [ ] Creates Memory rows with tier="propose" for proposals
- [ ] `npm run type-check` passes
- [ ] runNightlyReview() returns correct shape

**Time: 1.5 hours**

---

### Session 8: Create SLA Metrics Endpoint

**Before:**
- [ ] Read PROMPT 8 carefully
- [ ] Understand:
  - GET /api/metrics/job-slas
  - Optional query param: ?kind={job_kind}
  - Returns p50, p95, p99, mean, sample count

**During:**
- [ ] Open Cursor
- [ ] Paste PROMPT 8
- [ ] Review endpoint implementation

**After:**
- [ ] Create file: `app/api/metrics/job-slas/route.ts`
- [ ] Run: `npm run type-check`
- [ ] Dev server: `npm run dev`
- [ ] Manual test:
  ```bash
  curl http://localhost:3000/api/metrics/job-slas
  # Should return SLA metrics per job kind
  
  curl "http://localhost:3000/api/metrics/job-slas?kind=goal_synthesis"
  # Should return metrics for just that kind
  ```
- [ ] Commit: `git add app/api/metrics/job-slas && git commit -m "Phase 1: Add SLA metrics dashboard"`

**Success Criteria:**
- [ ] File created: `app/api/metrics/job-slas/route.ts`
- [ ] GET endpoint returns SLA data
- [ ] Can filter by job kind
- [ ] Returns p50, p95, p99, mean, sampleCount, successRate
- [ ] `npm run type-check` passes

**Time: 30 min**

---

## Week 4 Checkpoint (Friday EOD)

- [ ] Session 7 complete (night review)
- [ ] Session 8 complete (SLA metrics)
- [ ] Night review creates Memory rows correctly
- [ ] SLA metrics endpoint working
- [ ] All endpoints tested and working

---

## Final Phase 1 Checklist

### Database
- [ ] BackgroundJob extended (wallTimeMs, retryCount, proposalCount)
- [ ] BackgroundJobAudit created
- [ ] Memory extended (tier, proposedAt, approvedAt, appliedAt)
- [ ] Tables created: `npx drizzle-kit push`

### Query Module
- [ ] `lib/db/query-modules/backgroundJobs.ts` created
- [ ] All 7+ functions implemented
- [ ] Types correct

### API Endpoints
- [ ] POST /api/jobs working
- [ ] GET /api/jobs working
- [ ] GET /api/jobs/{id} working
- [ ] DELETE /api/jobs/{id} working
- [ ] POST /api/jobs/{id}/approve ready (for Phase 2)
- [ ] GET /api/metrics/job-slas working

### Queue Processor
- [ ] Processor created: `lib/background-jobs/processor.ts`
- [ ] processQueue() implemented
- [ ] executeWithRetry() with exponential backoff
- [ ] Idempotency check for nightly jobs

### Job Handlers
- [ ] Handlers created: `lib/background-jobs/handlers.ts`
- [ ] 4 async functions implemented
- [ ] Proper return types

### Night Review
- [ ] Night review creates insights (tier="observe")
- [ ] Night review creates proposals (tier="propose")
- [ ] No execution (Phase 3)

### Testing
- [ ] Jest tests created: `tests/api/jobs.test.ts`
- [ ] 6+ tests defined
- [ ] Tests pass: `npm test tests/api/jobs.test.ts`

### Code Quality
- [ ] `npm run type-check` passes (no errors)
- [ ] All imports correct
- [ ] No `any` types (TypeScript strict)
- [ ] Code follows existing Virgil patterns

### Documentation
- [ ] ADR-002 explains design
- [ ] Code has comments where needed
- [ ] Audit trail visible for debugging
- [ ] SLA metrics available

### Commits
- [ ] Session 1 committed
- [ ] Session 2 committed
- [ ] Session 3 committed
- [ ] Session 4 committed
- [ ] Session 5 committed
- [ ] Session 6 committed
- [ ] Session 7 committed
- [ ] Session 8 committed

---

## Phase 1 Success Criteria (Check All)

- [ ] Can create job: `POST /api/jobs` → returns jobId
- [ ] Can list jobs: `GET /api/jobs` → returns array
- [ ] Can get detail: `GET /api/jobs/{id}` → returns job + audit trail
- [ ] Can cancel job: `DELETE /api/jobs/{id}` → cancels pending job
- [ ] Can approve proposals: `POST /api/jobs/{id}/approve` → ready for Phase 2 UI
- [ ] Can get metrics: `GET /api/metrics/job-slas` → returns SLA data
- [ ] Jobs process async (queue processor running)
- [ ] Retry logic with exponential backoff
- [ ] Idempotency for nightly jobs
- [ ] Insights created (tier="observe")
- [ ] Proposals created (tier="propose")
- [ ] Jest tests passing
- [ ] TypeScript strict mode passing
- [ ] Full audit trail of state changes

**If all checked: Phase 1 is COMPLETE.** Ready for Phase 2.

---

## Next: Phase 2 (After Phase 1)

Phase 2 adds:
- [ ] User-facing approval UI
- [ ] Email notifications
- [ ] Morning digest of insights + proposals
- [ ] Analytics on accepted proposals

Phase 3 adds:
- [ ] Automation rules per domain
- [ ] Execution (tier="act")
- [ ] Undo/revert for mutations
- [ ] External integrations (Gmail, Slack)

---

## Print/Bookmark This

Use this checklist for:
- Tracking daily progress
- Verifying before moving to next session
- Remembering what's next
- Staying on 4-week timeline

---

## Questions During Implementation?

**Design:** Read `docs/ADR-002-three-paths-virgil.md`  
**Timeline:** Read `VIRGIL_PHASE1_SETUP.md`  
**Troubleshooting:** See `SESSION_SUMMARY_RECONCILIATION.md`  
**Quick reference:** See `QUICK_START.txt`  

Good luck! 🚀
