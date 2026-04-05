# Spike — Scheduling optimization and symbolic grounding (v2-oriented)

**Status:** Specification / research only — **no implementation in v1** unless explicitly prioritized.  
**Related:** [docs/V2_BEHAVIORAL_SPECS.md](../V2_BEHAVIORAL_SPECS.md) (weekly schedule proposal, briefing payload), [docs/TARGET_ARCHITECTURE.md](../TARGET_ARCHITECTURE.md) §2a (Cognitive layer), [docs/DECISIONS.md](../DECISIONS.md) (2026-04-05 tri-layer ADR).

## Intent

Evaluate how a future **v2 Python backend** (see [V2_ARCHITECTURE.md](../V2_ARCHITECTURE.md)) could:

1. Propose **week-level schedules** that respect fixed calendar blocks, habits, goal priorities, and project next-actions—without relying on an LLM for **feasibility** (only for **phrasing** or **explanation** if desired).
2. Keep outputs **grounded**: every suggested block must trace to **structured inputs** (calendar events, `Goal` / habit rows, health aggregates, owner-stated deadlines)—not free-generated fiction.

This ticket does **not** authorize calendar **writes** from automation without an explicit owner approval gate (align with [OWNER_PRODUCT_VISION.md](../OWNER_PRODUCT_VISION.md) suggest-only posture).

## Out of scope (explicit)

- Shipping OR-Tools, CP-SAT, or any solver **inside** this Next.js repo during v1.
- Replacing E11 Phase 3 (nudges / notifications) — that remains QStash-first per [PIVOT_EVENTS_AND_NUDGES.md](../PIVOT_EVENTS_AND_NUDGES.md).
- Full **property-graph** “digital twin” — spike may note graph-like relations (goal dependencies) but does not require a graph DB.

## Inputs (candidate)

| Source | Use |
|--------|-----|
| Google Calendar (read, already in v1) | Fixed immovable blocks, working hours |
| v1 `Goal` / `GoalCheckIn` + v2 habit tables (spec) | Deadlines, cadence, stale detection |
| Health snapshots / circadian proxies (if available) | Soft constraints (e.g. avoid deep work after poor sleep) — **heuristic**, not medical claims |
| Project next-actions ([V2_BEHAVIORAL_SPECS.md](../V2_BEHAVIORAL_SPECS.md) § Projects) | Task duration estimates, dependencies |

## Solver / reasoning approach (to evaluate in spike)

- Prefer **bounded** formulations: interval variables, cumulative constraints, optional tasks with penalties — e.g. **CP-SAT** (Google OR-Tools) or similar **constraint programming** over exhaustive permutation search.
- **Layered pipeline:** (1) hard constraints from calendar + fixed commitments, (2) soft scoring for goals/habits/energy heuristic, (3) optional LLM pass to **narrate** the plan — solver output is SSOT for times and IDs.
- **Symbolic / rules:** Deterministic checks (e.g. “BJJ slot conflicts with new meeting”) can live as **pure functions** over structured data before or after the solver; they are easier to audit than model-only reasoning.

## Safety gates (must carry into any implementation)

- **Human approval** before mutating external calendars or sending irreversible side effects.
- **Idempotency** for scheduled jobs that enqueue proposals (mirror night-review `windowKey` patterns where applicable).
- **Honest degradation** when data is missing — no fabricated events.

## Deliverables (spike)

1. **1–3 page** written outcome: chosen solver family, data prerequisites, API sketch (request/response) aligned with [V2_BEHAVIORAL_API.md](../V2_BEHAVIORAL_API.md) when relevant.
2. **Risk list:** quota, latency, wrong recommendations when estimates are wrong.
3. **Recommendation:** whether week-scale optimization belongs in v2 Phase 1 or later.

## Acceptance

- Spike doc committed under `docs/` or appended to v2 eval notes in `workspace/v2-eval/` **when the spike is executed** (this file remains the **ticket** until then).
- No change to default v1 chat behavior from this ticket alone.
