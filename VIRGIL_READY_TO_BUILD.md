# Virgil + Reconciliation: Ready to Build

## What Just Happened

I've created a complete Phase 1 implementation package for Virgil, based on the reconciliation blueprint (Three Paths, One Assistant + Three Tiers).

**The reconciliation unified:**
- **Async PA v2.0** (depth, nightly analysis, but unsafe auto-execution)
- **Cagent** (explicit job queues, but unclear safety)
- **Virgil** (user agency first, but under-articulated async UX)

**Result:** One system design (ADR-002) that works in Virgil's TypeScript/Next.js stack.

---

## Files Created in Virgil Repo

### Design Documents
- **`docs/ADR-002-three-paths-virgil.md`** (13 KB)
  - Design decision record adapted to Virgil
  - Problem, solution, technical architecture
  - Three paths (fast/slow/nightly) + three tiers (observe/propose/act)
  - Phases 1-5 roadmap

- **`docs/CURSOR_PROMPTS_TYPESCRIPT.md`** (28 KB)
  - 8 copy-paste prompts for Cursor
  - Each prompt is self-contained and detailed
  - TypeScript/Drizzle/Next.js specific
  - Testing commands included

- **`VIRGIL_PHASE1_SETUP.md`** (11 KB)
  - 4-week implementation timeline
  - 8 sessions (one per week day)
  - Weekly checklists and sync points
  - Troubleshooting guide

---

## What Gets Built (Phase 1)

### Database
✅ Extend `BackgroundJob` table (add wallTimeMs, retryCount, proposalCount)  
✅ Create `BackgroundJobAudit` table (state transition audit trail)  
✅ Extend `Memory` table (add tier: observe/propose/act)

### API Endpoints
✅ `POST /api/jobs` - Create async job (enqueue)  
✅ `GET /api/jobs` - List user's jobs  
✅ `GET /api/jobs/{jobId}` - Get job detail + audit trail  
✅ `POST /api/jobs/{jobId}/approve` - Approve proposals (Phase 2 uses this)  
✅ `DELETE /api/jobs/{jobId}` - Cancel pending job  
✅ `GET /api/metrics/job-slas` - SLA metrics per job kind

### Queue Processor
✅ Async job processor (pending → running → completed/failed)  
✅ Retry logic with exponential backoff  
✅ Idempotency for nightly jobs (only run once per user per day)  
✅ State tracking + full audit trail

### Night Review Integration
✅ Analyze user data (stub, Phase 2 adds real logic)  
✅ Create Insights as Memory rows (tier="observe")  
✅ Create Proposals as Memory rows (tier="propose")  
✅ No execution (Phase 3 adds that)

### Tests
✅ Jest unit tests (6+ tests)  
✅ API endpoint testing  
✅ Mock database functions

### No Approval Yet
❌ User approval UI (Phase 2)  
❌ Email notifications (Phase 2)  
❌ Execution/automation rules (Phase 3)

---

## How to Start

### Step 1: Read the Design (Today, 15 min)
```bash
cd /Users/caleb/Documents/virgil
cat docs/ADR-002-three-paths-virgil.md | head -100
```

### Step 2: Understand the Timeline (Today, 10 min)
```bash
cat VIRGIL_PHASE1_SETUP.md | grep "Session\|Week"
```

### Step 3: Start Session 1 (Tomorrow or Now)
1. Open Cursor
2. Go to `docs/CURSOR_PROMPTS_TYPESCRIPT.md`
3. Copy entire **PROMPT 1** (Database Schema)
4. Paste into Cursor chat
5. Let it generate schema changes
6. Review, accept, commit

---

## The 8-Session Plan

| Session | Task | Time | Deliverable |
|---------|------|------|-------------|
| 1 | Database schema | 30 min | BackgroundJobAudit table |
| 2 | Query module | 45 min | 7 query functions |
| 3 | API routes | 1 hr | 5 endpoints + metrics |
| 4 | Queue processor | 1.5 hrs | Job processor with retry |
| 5 | Job handlers | 30 min | 4 async handlers |
| 6 | Jest tests | 1 hr | 6+ passing tests |
| 7 | Night review | 1.5 hrs | Insights + proposals |
| 8 | SLA metrics | 30 min | Metrics dashboard |

**Total: ~8 hours over 4 weeks**

---

## Success Looks Like

**End of Phase 1:**
- ✅ POST /api/jobs creates a job (returns jobId, status="pending")
- ✅ Job starts processing automatically
- ✅ GET /api/jobs/{jobId} shows progress
- ✅ When complete, proposals are in Memory table (tier="propose")
- ✅ User can see proposals in UI (Phase 2 adds UI)
- ✅ Full audit trail of job state changes
- ✅ SLA metrics show wall time per job type

**NOT in Phase 1:**
- ❌ Approval UI
- ❌ Email notifications
- ❌ Execution of proposals
- ❌ Automation rules

---

## Key Differences: Personal Assistant vs Virgil

| Aspect | Personal Assistant (Python) | Virgil (TypeScript) |
|--------|---------------------------|-------------------|
| **Database** | New SQLAlchemy models | Extend existing Drizzle schema |
| **Queue** | Python async queue | Node.js worker (async processor) |
| **Proposals** | Separate table | Memory table with tier column |
| **Tests** | pytest | Jest |
| **Framework** | FastAPI | Next.js API routes |

---

## Why This Works for Virgil

Virgil already has:
✅ BackgroundJob table (just need to extend it)  
✅ Memory system for storing insights  
✅ Night review infrastructure  
✅ User-centric design (audit logs, reversibility)  
✅ Strong TypeScript setup

Phase 1 just:
- Extends existing tables
- Creates query module for type safety
- Adds API endpoints
- Implements queue processor
- Integrates with night review

No major architectural changes. Works within Virgil's existing patterns.

---

## Cursor's Role

Cursor will:
✅ Write all database schema changes  
✅ Generate all query functions  
✅ Create all API endpoints  
✅ Implement queue processor with retry logic  
✅ Write Jest tests  
✅ Integrate with night review  

You will:
✅ Review generated code  
✅ Test after each session  
✅ Provide clarifications if needed  
✅ Commit working code  

---

## Reconciliation Principles in Virgil

**Three Paths:**
- Fast (sync): Chat stays responsive
- Slow (async): POST /api/jobs → poll → results
- Nightly (batch): Analysis runs, insights + proposals created

**Three Tiers:**
- Observe: Insights (read-only, tier="observe")
- Propose: Proposals (drafts, tier="propose")
- Act: Execution (Phase 3, tier="act")

**Safety by Default:**
- No execution without approval
- Full audit trail
- Transparent to user
- User controls automation

---

## Next Steps

1. **Read ADR-002** (15 min)
   - Understand the design
   - See how it maps to Virgil

2. **Skim VIRGIL_PHASE1_SETUP.md** (10 min)
   - Get the timeline
   - Understand weekly checkpoints

3. **Open Cursor**
   - Go to `docs/CURSOR_PROMPTS_TYPESCRIPT.md`
   - Copy PROMPT 1
   - Paste and let it generate

4. **Test immediately**
   ```bash
   npx drizzle-kit push
   npm run type-check
   ```

5. **Keep going**
   - One prompt per session
   - Test after each
   - Follow the 4-week plan

---

## Questions Before Starting?

**About the design:** See `docs/ADR-002-three-paths-virgil.md`  
**About a prompt:** See `docs/CURSOR_PROMPTS_TYPESCRIPT.md`  
**About the timeline:** See `VIRGIL_PHASE1_SETUP.md`  
**About implementation:** Check existing Virgil code patterns (`lib/db/`, `app/api/`)

---

## You're Ready

All three documents are in your Virgil repo:
- `docs/ADR-002-three-paths-virgil.md` ← Design
- `docs/CURSOR_PROMPTS_TYPESCRIPT.md` ← Implementation
- `VIRGIL_PHASE1_SETUP.md` ← Timeline + checklist

Copy PROMPT 1 into Cursor. It'll generate the first database changes.

**Start now. Build over 4 weeks. End up with:**
- Jobs API (enqueue → poll)
- Tier 1 (Observe) - read-only insights
- Tier 2 (Propose) - draft proposals
- Full queue processor with retry + idempotency
- Phase 2-5 ready to build on top

You've got this. 🚀
