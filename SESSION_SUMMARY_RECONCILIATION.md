# Session Summary: Virgil Phase 1 Implementation

**Date:** 2024-01-15  
**Context:** Completed reconciliation of three async systems + created Phase 1 implementation package  
**Status:** Ready to build with Cursor  
**Location:** `/Users/caleb/Documents/virgil/`

---

## What We Accomplished

### 1. Reconciliation
Unified three separate async approaches into one coherent system:

**System 1: Async PA v2.0 (Python)**
- ✅ Depth: Multi-step analysis, nightly batch work
- ❌ Safety: Auto-execution without approval
- ❌ Transparency: Users don't see proposals

**System 2: Cagent (Docker's Agent Framework)**
- ✅ Safety: Explicit job queue, state machine
- ✅ Transparency: Clear job_id → poll → results UX
- ❌ Limitations: Designed for ops, not personal assistant

**System 3: Virgil (TypeScript/Next.js)**
- ✅ User Agency: Local-first, audit trails, explicit rules
- ✅ UX: Responsive chat, honest SLAs
- ❌ Under-articulated: Async story not clear, no proposal surface

### 2. Design Solution: Three Paths × Three Tiers

**Three Execution Paths:**
1. **Fast (Sync)** - Chat, verification, quick lookups (<500ms SLA)
2. **Slow (Async)** - Deep analysis, enqueue → poll → results (minutes)
3. **Nightly (Batch)** - Scheduled analysis, insights + proposals (background)

**Three Safety Tiers:**
1. **Observe** - Read-only insights (always safe, no approval)
2. **Propose** - Draft suggestions (requires explicit approval)
3. **Act** - Execute mutations (only with rule or one-tap approval, never silent)

**Product Narrative:**
> "Fast when you're in the room, thorough when you're not—nothing important changes your goals or reaches external systems without a visible proposal or an explicit rule you turned on."

---

## Phase 1 Deliverables (Complete Package)

### Design Documents Created

| File | Size | Purpose |
|------|------|---------|
| `docs/ADR-002-three-paths-virgil.md` | 13 KB | Architecture Decision Record + technical design |
| `docs/CURSOR_PROMPTS_TYPESCRIPT.md` | 28 KB | 8 copy-paste prompts for Cursor (Session 1-8) |
| `VIRGIL_PHASE1_SETUP.md` | 11 KB | 4-week timeline with weekly checkpoints |
| `VIRGIL_READY_TO_BUILD.md` | 7 KB | Executive summary & getting started |
| `QUICK_START.txt` | 4 KB | 5-minute reference guide |

### Implementation Plan (8 Sessions)

```
Week 1 (Database Layer):
  Session 1: BackgroundJob extend + BackgroundJobAudit create (30 min)
  Session 2: Query module with 7 async functions (45 min)

Week 2 (API Layer):
  Session 3: 5 API routes + metrics endpoint (1 hr)
  Session 4: Queue processor with retry + idempotency (1.5 hrs)

Week 3 (Handlers & Testing):
  Session 5: Job handler stubs (30 min)
  Session 6: Jest tests for all endpoints (1 hr)

Week 4 (Integration):
  Session 7: Night review extends to create insights + proposals (1.5 hrs)
  Session 8: SLA metrics dashboard endpoint (30 min)

Total: ~8 hours over 4 weeks
```

### Code Files to Be Created (via Cursor)

**Database Schema (extend existing):**
- `lib/db/schema.ts` - Extend BackgroundJob, create BackgroundJobAudit, extend Memory

**Query Module (new):**
- `lib/db/query-modules/backgroundJobs.ts` - 7 typed query functions

**API Routes (new):**
- `app/api/jobs/route.ts` - POST (create), GET (list)
- `app/api/jobs/[jobId]/route.ts` - GET (detail), DELETE (cancel)
- `app/api/jobs/[jobId]/approve/route.ts` - POST (approve proposals)
- `app/api/metrics/job-slas/route.ts` - GET (SLA metrics)

**Queue Processor (new):**
- `lib/background-jobs/processor.ts` - Job queue with retry, idempotency, state machine

**Job Handlers (new):**
- `lib/background-jobs/handlers.ts` - analyzeGoalsAsync, analyzeFitnessAsync, analyzeSpendingAsync, nightlyReviewAsync

**Tests (new):**
- `tests/api/jobs.test.ts` - Jest tests for all endpoints

**Integration (modify existing):**
- `lib/night-review/index.ts` - Create Memory rows (tier="observe" for insights, tier="propose" for proposals)

---

## Key Design Decisions

### 1. Database Schema
- **BackgroundJob** extended with:
  - `wallTimeMs`: Wall clock time for SLA tracking
  - `retryCount`: Tracks retry attempts
  - `proposalCount`: How many proposals this job generated
- **BackgroundJobAudit** (new):
  - Tracks all state transitions (pending → running → completed)
  - Actor field (system vs user)
  - Audit trail for debugging + transparency
- **Memory** extended with:
  - `tier: "observe" | "propose" | "act"`
  - `proposedAt`, `approvedAt`, `appliedAt` timestamps
  - Proposals stored as Memory rows (not separate table)

### 2. API Surface
5 endpoints (4 in Phase 1, approve ready for Phase 2):
- `POST /api/jobs` → Enqueue analysis (returns jobId, estimated wait)
- `GET /api/jobs` → List user's jobs with status
- `GET /api/jobs/{id}` → Detail + audit trail + proposals
- `DELETE /api/jobs/{id}` → Cancel pending job
- `POST /api/jobs/{id}/approve` → Approve selected proposals (Phase 2 UI uses this)
- `GET /api/metrics/job-slas` → SLA metrics per job kind

### 3. Queue Processing
- Poll model: Simple, reliable, no background process initially
- Retry with exponential backoff (2s, 4s, 8s)
- Idempotency check for nightly jobs (only once per user per day)
- Full state tracking + audit

### 4. Proposal Storage
- Proposals = Memory rows with `tier="propose"`
- Phase 2 adds approval UI to toggle `approvedAt`
- Phase 3 adds execution (set `appliedAt` + trigger action)
- Same table keeps it simple; tier column is the key

### 5. Job Handlers
- Phase 1: Stubs that sleep + return mock data (for testing SLAs)
- Phase 2: Real analysis logic (query db, use LLM, generate insights)
- Phase 3: Execute tier (create memories, send emails, integrations)

---

## Integration with Existing Virgil Code

### Already Exists
✅ `lib/db/schema.ts` - BackgroundJob table (needs extension)  
✅ `lib/night-review/` - Night review infrastructure  
✅ `lib/background-jobs/` - Directory exists  
✅ `Memory` table - Already stores user insights  
✅ Drizzle ORM + PostgreSQL setup  
✅ Next.js API routes pattern  

### Will Add
✅ Extend BackgroundJob (3 new columns)  
✅ Create BackgroundJobAudit table  
✅ Extend Memory (4 new columns)  
✅ Query module for type safety  
✅ 5 API endpoints  
✅ Queue processor  
✅ Job handlers (stubs)  
✅ Jest tests  

### No Breaking Changes
- Existing BackgroundJob rows unaffected
- Existing Memory rows get tier="observe" (default)
- Existing night review code modified, not replaced
- All backward compatible

---

## How to Start (Next Actions)

### Today (15 min)
1. Read `docs/ADR-002-three-paths-virgil.md` - Understand the design
2. Skim `VIRGIL_PHASE1_SETUP.md` - Understand the timeline
3. Review `docs/CURSOR_PROMPTS_TYPESCRIPT.md` - See what's coming

### Tomorrow (30 min - Session 1)
1. Open Cursor
2. Copy **PROMPT 1** from `docs/CURSOR_PROMPTS_TYPESCRIPT.md`
3. Paste into Cursor
4. Let it generate schema changes to `lib/db/schema.ts`
5. Test: `npx drizzle-kit push && npm run type-check`

### Week 1 (90 min total)
- Session 1: Database schema
- Session 2: Query module
- Test after each session

### Weeks 2-4 (follow timeline in VIRGIL_PHASE1_SETUP.md)
- Continue with Sessions 3-8
- One session per day
- Test immediately

---

## Success Criteria (Phase 1 Complete)

✅ **Database**
- BackgroundJob table extended (wallTimeMs, retryCount, proposalCount)
- BackgroundJobAudit table created
- Memory table has tier column (observe/propose/act)

✅ **API Endpoints**
- POST /api/jobs creates a job
- GET /api/jobs lists user's jobs
- GET /api/jobs/{id} returns detail + audit trail
- DELETE /api/jobs/{id} cancels job
- POST /api/jobs/{id}/approve endpoint ready
- GET /api/metrics/job-slas returns SLA data

✅ **Queue**
- Job processor executes async jobs
- Retry logic with exponential backoff
- Idempotency for nightly jobs

✅ **Night Review**
- Creates Insights (tier="observe") automatically
- Creates Proposals (tier="propose") automatically
- No execution (Phase 3)

✅ **Testing**
- Jest tests passing (6+)
- All endpoints tested
- TypeScript strict mode

✅ **Documentation**
- Code is self-documenting (comments, types)
- Audit trail visible for debugging
- SLA metrics available for monitoring

❌ **NOT in Phase 1**
- Approval UI (Phase 2)
- Email notifications (Phase 2)
- Execution/automation (Phase 3)

---

## Relationship to Async PA v2.0 + Cagent

### How It Differs

| Aspect | Async PA v2.0 | Cagent | Virgil Phase 1 |
|--------|---------------|--------|----------------|
| **Framework** | Python FastAPI | Docker agents | Next.js/Drizzle |
| **Database** | New SQLAlchemy | N/A (operates on state) | Extend existing |
| **Queue** | Python async queue | Explicit job_id responses | Node.js async processor |
| **State Machine** | Implicit | Explicit (cagent docs) | Explicit + audited |
| **Proposals** | Separate table | N/A | Memory tier column |
| **Safety** | Unsafe defaults (auto-execute) | User controls | Explicit tiers + approval |
| **Transparency** | Low (silent execution) | High | Very high (audit trail) |

### What We Took From Each

**From Async PA v2.0:**
- Depth: Multi-step analysis + nightly batch work
- Pattern: Analyze → Generate insights + proposals

**From Cagent:**
- Safety: Explicit job queue + state machine
- Transparency: job_id → poll → results UX
- Audit: Track state transitions

**From Virgil:**
- User agency first
- Local-first + explicit rules
- Reversible + auditable

### The Result
A system that has:
- **Depth** (nightly analysis, multi-step)
- **Safety** (explicit tiers, no silent execution)
- **Transparency** (full audit trail, job IDs, polls)
- **Simplicity** (fits in Virgil's existing stack)

---

## Files Reference

### In `/Users/caleb/Documents/virgil/`

**Core Design (Read First):**
- `docs/ADR-002-three-paths-virgil.md` - Full design doc (read this)
- `VIRGIL_READY_TO_BUILD.md` - Executive summary
- `QUICK_START.txt` - 5-minute cheat sheet

**Implementation (Use During Build):**
- `docs/CURSOR_PROMPTS_TYPESCRIPT.md` - All 8 prompts (copy-paste these)
- `VIRGIL_PHASE1_SETUP.md` - Week-by-week timeline + testing

**This File:**
- `SESSION_SUMMARY_RECONCILIATION.md` - You are here (reference)

### Existing Code (To Reference)

- `lib/db/schema.ts` - Existing schema (PROMPT 1 extends this)
- `lib/db/client.ts` - DB client
- `lib/db/query-modules/` - Existing query modules (follow pattern)
- `app/api/` - Existing API routes (follow pattern)
- `lib/night-review/` - Existing night review (PROMPT 7 modifies this)
- `lib/background-jobs/` - Directory for processor + handlers

---

## Troubleshooting During Implementation

### "PROMPT X generated wrong code"
- Review what it generated
- Ask Cursor for clarification: "This should only modify X table, not Y"
- Let Cursor regenerate

### "TypeScript errors after PROMPT 1"
- Run `npm run type-check` to see specific errors
- Cursor can usually fix by adding types or imports
- Ask: "Fix TypeScript errors in this code"

### "npx drizzle-kit push fails"
- Check `DATABASE_URL` is set: `echo $DATABASE_URL`
- Check schema syntax is valid
- Try: `npx drizzle-kit generate` first, then `push`

### "API endpoints 404"
- Verify files exist: `ls -la app/api/jobs/`
- Restart dev server: `npm run dev`
- Check for TypeScript errors: `npm run type-check`

### "Tests failing"
- Read error message (Jest output is clear)
- Often missing mocks or wrong imports
- Ask Cursor: "Fix this jest test error"

---

## What Cursor Will Do

Cursor is the workhorse for Phase 1. It will:

✅ Write all database schema changes  
✅ Generate all query functions (typed)  
✅ Create all API endpoints  
✅ Implement queue processor (with retry logic)  
✅ Write job handler stubs  
✅ Generate Jest tests  
✅ Integrate with existing night review  

You will:
✅ Review code before accepting  
✅ Test after each session  
✅ Provide clarifications if needed  
✅ Commit working code  
✅ Move to next prompt

---

## Timeline at a Glance

| Week | Sessions | Total | Deliverable |
|------|----------|-------|-------------|
| 1 | 1-2 | 1.25 hrs | Database schema + query module |
| 2 | 3-4 | 2.5 hrs | API endpoints + queue processor |
| 3 | 5-6 | 1.5 hrs | Job handlers + tests |
| 4 | 7-8 | 2 hrs | Night review integration + metrics |

**Total: ~8 hours over 4 weeks**

---

## Phase 2 & 3 (After Phase 1)

**Phase 2: Approval UI + Notifications**
- User sees proposals in chat/dashboard
- Can approve/reject individual proposals
- Email digest of pending proposals
- Morning notification with insights

**Phase 3: Execution + Automation**
- User automation rules per domain
- Execute approved proposals automatically
- Audit + undo for important changes
- External integrations (Gmail, Slack, Google Calendar)

---

## Key Mindset for Phase 1

1. **Database First** - Get schema right, everything else flows from it
2. **Type Safety** - Use TypeScript strictly; types catch bugs
3. **Audit Everything** - State changes are logged; transparency is key
4. **Test Immediately** - After each session, not at the end
5. **Follow Patterns** - Existing Virgil code has patterns; follow them
6. **Stubs are OK** - Phase 1 handlers can be stubs; real logic comes Phase 2

---

## Questions?

**Design questions?**
→ Read `docs/ADR-002-three-paths-virgil.md`

**Implementation questions?**
→ Read `docs/CURSOR_PROMPTS_TYPESCRIPT.md` + look at existing Virgil code

**Timeline questions?**
→ See `VIRGIL_PHASE1_SETUP.md` weekly checklist

**Stuck?**
→ Ask Cursor for clarification with context: "I'm in the Virgil repo, implementing Phase 1 per ADR-002..."

---

## Ready?

```bash
cd /Users/caleb/Documents/virgil

# Step 1: Read the design (15 min)
cat docs/ADR-002-three-paths-virgil.md | head -150

# Step 2: Open Cursor and copy PROMPT 1
cat docs/CURSOR_PROMPTS_TYPESCRIPT.md | grep -A 60 "PROMPT 1"

# Step 3: Let Cursor generate, then test
npx drizzle-kit push
npm run type-check
```

You've got everything you need. Start with PROMPT 1 tomorrow (or today).

Good luck building Phase 1! 🚀
