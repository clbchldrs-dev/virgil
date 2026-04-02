# V2-T5 — Night review / digest / agent tasks vs v2 night mode (parity matrix)

**Track:** V2 groundwork — [overview](2026-04-01-v2-groundwork-overview.md)  
**Status:** Not started

## Problem

v1 has **night review**, **daily digest**, and **agent task triage** (QStash + cron). v2 [V2_ARCHITECTURE.md](../V2_ARCHITECTURE.md) defines a unified **night controller** with budgets and task types. Without a parity doc, we duplicate logic or miss idempotency/budget lessons.

## Goal

Add **`docs/V2_NIGHT_PARITY.md`** with:

1. **Matrix** rows: v1 job (night review enqueue/run, digest, agent-task enqueue/triage) × columns: trigger, budget/cost model, idempotency key, outputs, failure mode.
2. **Mapping** to v2 night task types (briefing precompute, self-eval, consolidation, stale scan, research queue, skill health)—mark **direct port**, **merge**, or **v1-only for now**.
3. **Deferred work queue:** what v1 could log today (e.g. agent tasks, night findings) as input to v2’s overnight queue—documentation only unless a one-row schema note fits in T4.

4. **Cron / QStash** constraints: reference [AGENTS.md](../../AGENTS.md) Hobby two-cron limit; self-hosted pattern.

## Non-goals

- Implementing v2 night mode in TypeScript.
- Changing cron schedules without owner approval.

## Acceptance criteria

1. Doc exists; linked from [2026-04-01-v2-groundwork-overview.md](2026-04-01-v2-groundwork-overview.md) and [V2_MIGRATION.md](../V2_MIGRATION.md) (short bullet under pre-migration).
2. Matrix has **≥4** v1 rows with accurate route paths (`/api/night-review/*`, `/api/digest`, `/api/agent-tasks/*`).
3. Explicit note on **idempotency** (window keys, completion rows) copied or summarized from existing code comments.

## Key files

- `app/api/night-review/*`, `app/api/digest/*`, `app/api/agent-tasks/*`
- `lib/agent-tasks/*`, `lib/night-review/*`
- [workspace/night/README.md](../../workspace/night/README.md)
