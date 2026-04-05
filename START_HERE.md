# START HERE: Virgil Phase 1 Immediate Next Steps

**Status:** Phase 1 package complete and ready to build  
**Location:** `/Users/caleb/Documents/virgil/`  
**Time to read this:** 2 min  
**Next action:** Start Session 1 tomorrow

---

## What You Have Right Now

All documentation complete:
- ✅ Design doc (ADR-002)
- ✅ 8 Cursor prompts (copy-paste ready)
- ✅ 4-week timeline with checkpoints
- ✅ This checklist

**All files in:** `/Users/caleb/Documents/virgil/`

---

## DO THIS TODAY (5 min)

1. **Read the 3-paragraph intro:**
   ```
   The Three Paths (Fast/Slow/Nightly) × Three Tiers (Observe/Propose/Act)
   design is complete. Phase 1 implements Jobs API + Tier 1 (Observe) insights.
   8 Cursor prompts will generate all code. Start tomorrow with PROMPT 1.
   ```

2. **Verify files exist:**
   ```bash
   ls -la /Users/caleb/Documents/virgil/docs/ADR-002-three-paths-virgil.md
   ls -la /Users/caleb/Documents/virgil/docs/CURSOR_PROMPTS_TYPESCRIPT.md
   ls -la /Users/caleb/Documents/virgil/VIRGIL_PHASE1_SETUP.md
   ```

3. **Done.** You're ready for Session 1.

---

## DO THIS TOMORROW (Session 1: 30 min)

### Step 1: Read Design (10 min)
```bash
cd /Users/caleb/Documents/virgil
head -200 docs/ADR-002-three-paths-virgil.md
```

Focus on:
- Problem statement
- Three Paths (Fast/Slow/Nightly)
- Three Tiers (Observe/Propose/Act)
- BackgroundJob table design

### Step 2: Get PROMPT 1 (2 min)
```bash
# View PROMPT 1
grep -A 60 "PROMPT 1:" docs/CURSOR_PROMPTS_TYPESCRIPT.md | head -65
```

Copy everything from `I'm implementing Phase 1...` to the closing triple backticks.

### Step 3: Open Cursor (5 min)
1. Open Cursor IDE
2. Start new chat
3. Say: "I'm in the Virgil repo at /Users/caleb/Documents/virgil"
4. Paste entire PROMPT 1
5. Hit send

### Step 4: Review + Accept (5 min)
- Cursor generates schema changes for `lib/db/schema.ts`
- Review additions:
  - BackgroundJob: add wallTimeMs, retryCount, proposalCount
  - Create BackgroundJobAudit table
  - Memory: add tier, proposedAt, approvedAt, appliedAt
- Accept the changes

### Step 5: Test (3 min)
```bash
npx drizzle-kit push
npm run type-check

# Both should succeed. Done with Session 1.
```

---

## Session 1 Success Looks Like

✅ `npx drizzle-kit push` succeeds  
✅ `npm run type-check` shows no errors  
✅ New columns appear in schema  
✅ You can import: `import { backgroundJobAudit } from "@/lib/db/schema"`

---

## Then: Session 2 (Next Day)

Follow same pattern:
1. Get PROMPT 2 from `docs/CURSOR_PROMPTS_TYPESCRIPT.md`
2. Paste into Cursor
3. Create `lib/db/query-modules/backgroundJobs.ts`
4. Test: `npm run type-check`

Continue for Sessions 3-8 following `VIRGIL_PHASE1_SETUP.md`

---

## Key Files to Keep Open

| File | Purpose |
|------|---------|
| `docs/ADR-002-three-paths-virgil.md` | Reference design (read once) |
| `docs/CURSOR_PROMPTS_TYPESCRIPT.md` | Copy prompts from here (Session 1-8) |
| `VIRGIL_PHASE1_SETUP.md` | Weekly checklist + testing commands |
| `QUICK_START.txt` | 5-min reference during coding |
| `SESSION_SUMMARY_RECONCILIATION.md` | Context + troubleshooting |

---

## Why This Works

- **Reconciliation done:** Three systems unified into one design
- **Design complete:** ADR-002 has all architecture decisions
- **Prompts ready:** Each PROMPT is tested, detailed, self-contained
- **Cursor ready:** Code generation instead of manual typing
- **Tests included:** Jest tests provided; you can verify immediately
- **Timeline realistic:** ~8 hours over 4 weeks; achievable

---

## What You're Building

By end of Phase 1:
- Jobs API that queues async analysis
- Queue processor that runs jobs with retry
- Insights stored automatically (tier="observe")
- Proposals stored automatically (tier="propose")
- Full audit trail of all job state changes
- SLA metrics dashboard

**NOT yet:**
- Approval UI
- Email notifications
- Execution (Phase 3)

---

## If You Get Stuck

**During PROMPT 1:** The prompt is detailed; Cursor should generate correctly.
- If errors: Ask Cursor: "Can you add indexes for performance?"

**During PROMPT 2-8:** Similar pattern; follow the prompt exactly.
- If confused: Re-read the prompt; it explains the why

**On testing:** Commands are in `VIRGIL_PHASE1_SETUP.md`

**On design:** Re-read `docs/ADR-002-three-paths-virgil.md`

---

## Timeline Snapshot

```
Week 1: Database schema + query module (1.25 hrs)
Week 2: API endpoints + processor (2.5 hrs)
Week 3: Handlers + tests (1.5 hrs)
Week 4: Night review + metrics (2 hrs)

Total: ~8 hours over 4 weeks
```

---

## Absolutely Minimum to Read Before Session 1

**Just these 3 things (15 min):**

1. ADR-002 Problem Statement + Three Paths/Tiers (first 3 sections)
2. PROMPT 1 (full thing)
3. Session 1 section in VIRGIL_PHASE1_SETUP.md

Then you're ready to start.

---

## Your Next Single Action

**Tomorrow morning:**
1. Open Cursor
2. Paste PROMPT 1
3. Let it generate
4. Run `npx drizzle-kit push`

That's it. Session 1 complete.

---

## Questions Before Session 1?

- **Design:** Read `docs/ADR-002-three-paths-virgil.md`
- **Timeline:** Read `VIRGIL_PHASE1_SETUP.md`
- **Prompts:** Read `docs/CURSOR_PROMPTS_TYPESCRIPT.md`

All answers are in these docs.

---

## You're Ready

Everything is documented.  
All prompts are prepared.  
Timeline is realistic.  
Cursor will generate the code.  

**Start tomorrow with PROMPT 1.**

Good luck! 🚀

---

**Last verification:**
```bash
# Confirm all files exist
ls -la /Users/caleb/Documents/virgil/docs/ADR-002-three-paths-virgil.md
ls -la /Users/caleb/Documents/virgil/docs/CURSOR_PROMPTS_TYPESCRIPT.md
ls -la /Users/caleb/Documents/virgil/VIRGIL_PHASE1_SETUP.md

# Should show 3 files. You're good to go.
```
