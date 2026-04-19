# Virgil Phase 1 Setup — Cursor Implementation Guide

> **Historical — Phase 1 (2024).** Superseded for setup by [`AGENTS.md`](AGENTS.md) (Setup checklist, Postgres/Redis, Docker). Keep this file only for narrative context on the original ADR-002 sprint.

**Goal:** Implement Three Paths, One Assistant in Virgil (TypeScript/Next.js)  
**Timeline:** 4 weeks, 8 Cursor sessions  
**Deliverable:** Jobs API + Tier 1 (Observe) + Tier 2 (Propose, no approval yet)

---

## Prerequisites

✅ Virgil repo (`/Users/caleb/Documents/virgil`)  
✅ Node.js + pnpm installed  
✅ PostgreSQL running (Docker or local)  
✅ `.env` configured (DATABASE_URL, etc.)  
✅ Cursor IDE open

---

## What You're Building

**Phase 1 delivers:**
- `BackgroundJob` table + API for async job queueing
- Job state machine: pending → running → completed/failed
- Queue processor with retry logic and idempotency
- Insights stored in Memory table (tier="observe")
- Proposals stored in Memory table (tier="propose")
- 5 API endpoints: POST, GET, GET/{id}, POST/{id}/approve, DELETE
- SLA metrics dashboard

**Phase 1 does NOT:**
- Execute proposals or create real changes (Phase 3)
- Send emails or external calls (Phase 3)
- Require user approval yet (Phase 2)

---

## Week 1: Database + Query Layer

### Session 1 (Day 1): Database Schema

**File:** `lib/db/schema.ts`

**Cursor Prompt:** Copy entire **PROMPT 1** from `docs/CURSOR_PROMPTS_TYPESCRIPT.md`

**Steps:**
1. Open Cursor
2. Paste PROMPT 1
3. Let it generate schema changes
4. Review additions (wallTimeMs, retryCount, proposalCount, backgroundJobAudit, tier)
5. Apply migrations:
   ```bash
   npx drizzle-kit generate
   npx drizzle-kit push
   ```

**Test:**
```bash
# Verify tables exist
npx drizzle-kit introspect
# Should show: BackgroundJob (modified), BackgroundJobAudit (new), Memory (modified)
```

**Time:** 30 min

---

### Session 2 (Day 2): Query Module

**File:** Create `lib/db/query-modules/backgroundJobs.ts`

**Cursor Prompt:** Copy **PROMPT 2** from `docs/CURSOR_PROMPTS_TYPESCRIPT.md`

**Steps:**
1. Paste PROMPT 2
2. Let Cursor generate full query module
3. Review functions:
   - createJob, getJob, listUserJobs
   - updateJobStatus, cancelJob
   - logJobAudit, getJobAuditTrail
   - getJobMetrics
4. Test:
   ```bash
   npm run type-check  # Should have no errors
   ```

**Time:** 45 min

---

## Week 2: API + Processor

### Session 3 (Day 3): API Routes

**Files:** Create `app/api/jobs/`

**Cursor Prompt:** Copy **PROMPT 3** from `docs/CURSOR_PROMPTS_TYPESCRIPT.md`

**Steps:**
1. Paste PROMPT 3
2. Cursor creates:
   - `app/api/jobs/route.ts` (POST + GET)
   - `app/api/jobs/[jobId]/route.ts` (GET + DELETE)
   - `app/api/jobs/[jobId]/approve/route.ts` (POST)
   - `app/api/metrics/job-slas/route.ts` (GET)
3. Start dev server:
   ```bash
   npm run dev
   ```
4. Test:
   ```bash
   curl -X POST http://localhost:3000/api/jobs \
     -H "Content-Type: application/json" \
     -d '{"kind":"goal_synthesis","userId":"test-user","input":{}}'
   # Should return: { jobId: "...", status: "pending" }
   ```

**Time:** 1 hour

---

### Session 4 (Day 4-5): Job Processor

**File:** Create `lib/background-jobs/processor.ts`

**Cursor Prompt:** Copy **PROMPT 4** from `docs/CURSOR_PROMPTS_TYPESCRIPT.md`

**Steps:**
1. Paste PROMPT 4
2. Cursor generates queue processor
3. Review key functions:
   - processQueue() - main loop
   - executeWithRetry() - retry logic
   - checkNightlyAlreadyRan() - idempotency
4. Test processor (run in separate terminal):
   ```bash
   node -e "require('./lib/background-jobs/processor').processQueue()"
   # Should start processing pending jobs
   ```

**Time:** 1.5 hours

---

## Week 3: Handlers + Tests

### Session 5 (Day 6): Job Handlers (Stubs)

**File:** Create `lib/background-jobs/handlers.ts`

**Cursor Prompt:** Copy **PROMPT 5** from `docs/CURSOR_PROMPTS_TYPESCRIPT.md`

**Steps:**
1. Paste PROMPT 5
2. Cursor generates handlers:
   - analyzeGoalsAsync() - stub that sleeps 2s
   - analyzeFitnessAsync() - stub that sleeps 15s
   - analyzeSpendingAsync() - stub that sleeps 20s
   - nightlyReviewAsync() - orchestrator
3. Test:
   ```bash
   npm run type-check
   # Should have no errors
   ```

**Time:** 30 min

---

### Session 6 (Day 7): Jest Tests

**File:** Create `tests/api/jobs.test.ts`

**Cursor Prompt:** Copy **PROMPT 6** from `docs/CURSOR_PROMPTS_TYPESCRIPT.md`

**Steps:**
1. Paste PROMPT 6
2. Cursor generates Jest tests for all endpoints
3. Run tests:
   ```bash
   npm test tests/api/jobs.test.ts
   # Should show 6+ tests passing
   ```

**Time:** 1 hour

---

## Week 4: Night Review + Metrics

### Session 7 (Day 8-9): Night Review Integration

**File:** Modify `lib/night-review/index.ts`

**Cursor Prompt:** Copy **PROMPT 7** from `docs/CURSOR_PROMPTS_TYPESCRIPT.md`

**Steps:**
1. Paste PROMPT 7
2. Cursor updates night review to:
   - Analyze user data (stub)
   - Create Insight memories (tier="observe")
   - Create Proposal memories (tier="propose")
   - Return counts
3. Test manually:
   ```bash
   # You can call the function directly in a script
   node -e "require('./lib/night-review').runNightlyReview('test-user').then(r => console.log(r))"
   # Should return: { insightsCount: 3, proposalsCount: 3 }
   ```

**Time:** 1.5 hours

---

### Session 8 (Day 10): SLA Metrics

**File:** Create `app/api/metrics/job-slas/route.ts`

**Cursor Prompt:** Copy **PROMPT 8** from `docs/CURSOR_PROMPTS_TYPESCRIPT.md`

**Steps:**
1. Paste PROMPT 8
2. Cursor creates metrics endpoint
3. Test:
   ```bash
   curl http://localhost:3000/api/metrics/job-slas
   # Should return SLA data per job kind
   
   curl "http://localhost:3000/api/metrics/job-slas?kind=goal_synthesis"
   # Should return metrics for just goal_synthesis
   ```

**Time:** 30 min

---

## Weekly Sync Points

### Week 1 Checklist (Friday)
- [ ] BackgroundJob table extended (wallTimeMs, retryCount, proposalCount)
- [ ] BackgroundJobAudit table created
- [ ] Memory table has tier column (observe/propose/act)
- [ ] Query module created with 7 functions
- [ ] npm run type-check passes

### Week 2 Checklist (Friday)
- [ ] All 5 API routes created
- [ ] POST /api/jobs creates a job
- [ ] GET /api/jobs lists jobs
- [ ] GET /api/jobs/{id} returns detail + audit trail
- [ ] DELETE /api/jobs/{id} cancels job
- [ ] POST /api/jobs/{id}/approve endpoint exists

### Week 3 Checklist (Friday)
- [ ] Job processor runs without errors
- [ ] Job handlers (stubs) execute
- [ ] Jest tests passing (6+ tests)
- [ ] Night review creates insights + proposals
- [ ] All types correct (no `any`)

### Week 4 Checklist (Friday)
- [ ] SLA metrics endpoint returns data
- [ ] Can query metrics by job kind
- [ ] All code documented
- [ ] No TypeScript errors
- [ ] Ready for Phase 2

---

## Testing Checklist (Daily)

After each session, run:

```bash
# Schema changes
npx drizzle-kit push

# Type checking
npm run type-check

# Tests
npm test tests/api/jobs.test.ts

# Dev server
npm run dev
# Then in another terminal:
curl http://localhost:3000/api/jobs?userId=test-user
```

---

## Common Issues & Solutions

**Issue: TypeScript errors after Cursor changes**
```bash
npm install  # Ensure dependencies
npm run type-check  # Check specific errors
# If still errors, ask Cursor to fix with: "Add proper TypeScript types for this function"
```

**Issue: Database migration fails**
```bash
# Verify connection
echo $DATABASE_URL  # Should be set

# Try manual push
npx drizzle-kit push

# If fails, check schema syntax and try again
```

**Issue: API endpoints 404**
```bash
# Verify file exists: ls -la app/api/jobs/

# Restart dev server: npm run dev

# Test with curl to see actual errors
curl -X POST http://localhost:3000/api/jobs -v
```

**Issue: Cursor generated wrong code**
- Review what it generated
- Provide clarification: "Per ADR-002, the tier column should only be on Memory table, not BackgroundJob"
- Let Cursor regenerate

---

## Files You're Creating

| File | Session | Purpose |
|------|---------|---------|
| lib/db/schema.ts (extend) | 1 | Add BackgroundJobAudit, extend BackgroundJob/Memory |
| lib/db/query-modules/backgroundJobs.ts | 2 | Query functions for jobs |
| app/api/jobs/route.ts | 3 | POST /api/jobs, GET /api/jobs |
| app/api/jobs/[jobId]/route.ts | 3 | GET /api/jobs/{id}, DELETE |
| app/api/jobs/[jobId]/approve/route.ts | 3 | POST /api/jobs/{id}/approve |
| app/api/metrics/job-slas/route.ts | 3 | GET /api/metrics/job-slas |
| lib/background-jobs/processor.ts | 4 | Queue processor |
| lib/background-jobs/handlers.ts | 5 | Job handlers (stubs) |
| tests/api/jobs.test.ts | 6 | Jest tests |
| lib/night-review/index.ts (modify) | 7 | Create insights/proposals |

---

## Success at End of Phase 1

✅ **API Working:**
- Create jobs: `POST /api/jobs`
- List jobs: `GET /api/jobs`
- Get detail: `GET /api/jobs/{id}`
- Cancel job: `DELETE /api/jobs/{id}`
- Approve proposals: `POST /api/jobs/{id}/approve` (ready for Phase 2)

✅ **Database:**
- BackgroundJob tracks wall time, retry count, proposal count
- BackgroundJobAudit logs all state changes
- Memory tier system (observe/propose/act)

✅ **Queue:**
- Jobs process asynchronously
- Retry with exponential backoff
- Idempotency for nightly jobs (only run once per user per day)

✅ **Night Review:**
- Creates Insights (tier="observe") automatically
- Creates Proposals (tier="propose") for user review
- No execution (Phase 3 adds that)

✅ **Testing:**
- 6+ Jest tests passing
- Manual API tests working
- TypeScript strict mode passing

✅ **Documentation:**
- ADR-002 explains design
- CURSOR_PROMPTS_TYPESCRIPT.md explains each step
- Code is self-documenting (good names, comments)

---

## Next: Phase 2 (After Phase 1)

Phase 2 adds:
- Approval UI (view proposals, approve/reject)
- Email notifications ("You have 3 pending proposals")
- Morning digest of insights + proposals
- Analytics on which proposals users accept

Phase 3 adds:
- Automation rules per domain
- Execution tier (Act)
- Audit + undo for mutations
- External integrations (Gmail, Slack, etc.)

---

## Cursor Workflow Tips

1. **Read the prompt carefully:** Each PROMPT is detailed and self-contained
2. **Provide context once:** "I'm in /Users/caleb/Documents/virgil, TypeScript/Next.js project"
3. **Let Cursor generate:** Don't interrupt
4. **Review before accepting:** Read generated code, ask for adjustments if needed
5. **Test immediately:** Don't wait until end of week

Example conversation:
```
You: [Paste PROMPT 1]
Cursor: [Generates schema changes]
You: [Review changes]
You: "Can you add an index on userId + kind for better query performance?"
Cursor: [Updates schema]
You: [Test with npx drizzle-kit push]
```

---

## Questions?

- **Design questions:** See `docs/ADR-002-three-paths-virgil.md`
- **Cursor prompt issues:** See `docs/CURSOR_PROMPTS_TYPESCRIPT.md`
- **Implementation issues:** Check existing code patterns in `lib/db/`, `app/api/`
- **TypeScript errors:** Run `npm run type-check` for details

---

## Ready?

1. **Today:** Read ADR-002 (15 min)
2. **Tomorrow:** Session 1 with Cursor (PROMPT 1, 30 min)
3. **This Week:** Complete Sessions 2-4 (4 hours total)
4. **Next Week:** Complete Sessions 5-7
5. **Final Week:** Session 8 + integration testing + cleanup

**Start now: Open Cursor, paste PROMPT 1 from docs/CURSOR_PROMPTS_TYPESCRIPT.md**

Good luck! 🚀
