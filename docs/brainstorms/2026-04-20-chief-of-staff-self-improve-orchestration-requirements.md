---
date: 2026-04-20
topic: chief-of-staff-self-improve-orchestration
---

# Self-improving chief of staff: orchestration, ubiquity, and failsafe posture

## Problem Frame

The owner wants Virgil to feel like a **chief of staff** that **gets better over time**—not only through model upgrades but through **structured improvement loops** (tasks, triage, approved changes) while remaining **reachable across surfaces** and **honest when something is down**. Today the repo already has seeds of this (`submitAgentTask`, approval workflows, optional gateway multi-stage planners, delegation bridges). The gap is **clarity of product intent**: what “self-improving” means in scope, how it interacts with **safety and cost**, and how **multi-agent orchestration** supports the loop without becoming an unbounded complexity or spend trap.

**Primary capability (brainstorm decision):** the **self-improvement loop** is primary for 6–12 months; **ubiquity**, **failsafe continuity**, and **multi-agent orchestration** are real but secondary enablers or guardrails.

## Requirements

**Self-improvement loop**

- R1. **Human approval before execution** — Changes that alter Virgil’s behavior, repository, or operator-critical configuration require an **explicit owner approval step** distinct from casual chat; the system must not silently treat “assistant agreed” as “ship it.”
- R2. **Structured intake** — Improvements are captured as **durable artifacts** (title, description, type, priority, optional approach and file hints) with a stable lifecycle from submitted → reviewed → in progress → done (or rejected), traceable over time.
- R3. **Triage as signal, not authority** — Automated or model-assisted triage may summarize risks, suggest scope, or estimate effort; it **must not** auto-approve work or override owner judgment on priority or safety.
- R4. **Feedback into quality** — Completed tasks should be able to **inform future behavior** (e.g., prompt/tool adjustments, documented patterns) in a way the owner can audit—without implying continuous unsupervised self-modification of production.

**Failsafe continuity**

- R5. **Degraded honesty** — When gateway, local inference, or delegation is unavailable, the product **states what is missing** and which features are limited; it avoids fabricating successful execution of tools or external work.
- R6. **Queue durability** — Self-improvement items and their status are not lost because a single runtime path (e.g., one region, one worker, one tunnel) hiccupped; the owner can return and see consistent state.

**Ubiquitous access (secondary)**

- R7. **Consistent mental model** — Where the stack allows, the owner encounters the **same task and memory story** across the primary web app and scripted or LAN workflows (subject to existing single-owner and auth constraints)—without promising identical UX on every surface.

**Multi-agent orchestration (secondary)**

- R8. **Budgeted orchestration** — Planner stages, specialists, or delegated executors run under **explicit operator-visible cost/latency posture** (env or settings), not unbounded fan-out by default.
- R9. **Observability for operators** — For orchestration that affects self-improvement or delegation, operators can answer: what ran, on what path, and whether it succeeded—at least at the level of logs or deployment-visible status the product already favors.

## Success Criteria

- An owner can describe **how Virgil improves** in one sentence: **structured tasks + approval + traceable outcomes**, not “it rewires itself.”
- A skeptical reviewer can verify **where approval happens** and that **triage cannot approve** on the owner’s behalf.
- Orchestration and delegation are **optional accelerants**, not prerequisites for the self-improvement story to be coherent.

## Scope Boundaries

- **Not** a commitment to fully autonomous coding agents, unsupervised repo writes, or continuous self-merge to `main` without human gates.
- **Not** multi-tenant SaaS or shared workspaces; single-owner patterns in `AGENTS.md` remain authoritative.
- **Not** the v2 Python backend as a dependency for this narrative unless a future plan explicitly bridges it; v2 remains a separate track.

## Key Decisions

- **Primary vs secondary:** Self-improvement loop first; ubiquity, failsafe, and multi-agent orchestration support or constrain it rather than competing for the same headline.
- **Safety model:** Approval and explicit gates beat “smarter model” as the ultimate failsafe for behavioral and repo change.
- **Tiered approval (2026-04-20):** In-app approval suffices for most self-improvement tasks; **high-impact** work (e.g. infra, security-sensitive, repo-wide blast radius) requires an **additional out-of-band** checkpoint (e.g. GitHub review or a documented operator ritual). Exact tier boundaries belong in planning.

## Dependencies / Assumptions

- Builds on existing **agent task** and triage concepts documented in `AGENTS.md` and `docs/ENHANCEMENTS.md` (E9 direction).
- **Unverified without a product audit:** whether current UI and APIs fully satisfy R1/R4 end-to-end for every improvement path; planning should validate against the live flows.

## Outstanding Questions

### Resolve Before Planning

_(None — tiered approval policy decided 2026-04-20.)_

### Deferred to Planning

- [Affects R1][Technical] Define **high-impact** tiers and map each to required checkpoints (in-app only vs GitHub vs ritual).
- [Affects R4][Technical] How should task state **reconcile** if GitHub Issues and Postgres diverge?
- [Affects R8–R9][Needs research] What **metrics or caps** match operator tolerance for planner chains and delegation on Vercel vs LAN workers?

## Next Steps

- **`/ce:plan`** — phased implementation map that ties R1–R9 to concrete surfaces, defines high-impact tiers, and lists verification.
- **`/ce:work`** — only after a plan exists or for a deliberately small slice scoped from this doc.

## Alternatives considered

- **Orchestration-first** — Lead with multi-agent topology; rejected as primary because it risks complexity without a clear improvement loop story.
- **Ubiquity-first** — Lead with surfaces and sync; valuable but does not alone produce self-improvement without task/approval semantics.
- **Failsafe-first** — Lead with degradation; necessary guardrail but insufficient as the defining product narrative for “self-improving.”
