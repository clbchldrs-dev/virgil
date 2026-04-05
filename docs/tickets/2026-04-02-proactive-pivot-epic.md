# Epic — Proactive agent pivot (v1 alignment)

**Enhancement:** E11 ([ENHANCEMENTS.md](../ENHANCEMENTS.md))  
**Status:** Planning — phases ship as separate branches per external prompt  
**External reference:** Owner’s `virgil-pivot-prompt.md` (Downloads) — **not** committed to repo; this epic is the in-repo SSOT.

## Intent

Move from **reactive chat only** toward **proactive** awareness: semantic recall, structured goals, async signals, intent-aware prompts, optional model cascade, progressive summarization—while preserving **local-first**, **no sycophancy**, and **suggest-only** automated actions.

## Locked alignment decisions (repo)

| Topic | SSOT |
|-------|------|
| Semantic recall | [docs/DECISIONS.md](../DECISIONS.md) — 2026-04-02 (hybrid: FTS baseline, Mem0 optional, pgvector in same Postgres when Phase 1 ships + follow-up ADR) |
| Goals SSOT | [2026-04-02-pivot-goals-layer-design.md](2026-04-02-pivot-goals-layer-design.md) |
| Events / nudges | [docs/PIVOT_EVENTS_AND_NUDGES.md](../PIVOT_EVENTS_AND_NUDGES.md) |

## Phase map (from external prompt; sequencing adjusted for this codebase)

| Phase | Theme | Branch name (suggested) | Depends on | Notes |
|-------|--------|-------------------------|------------|--------|
| 1 | Vector memory (pgvector + Ollama embeddings) | `feat/pivot-vector-memory` | ADR at ship time | Pause until migration + tests; FTS fallback required per DECISIONS |
| 2 | Goal-state tracker + tools | `feat/pivot-goal-tracker` | Goals design ticket | **Shipped:** `Goal` / `GoalCheckIn` tables, `listGoals` / `createGoal` / `checkInGoal` tools, prompt context via `formatActiveGoalsForPrompt` |
| 3 | Event bus + notifications | `feat/pivot-events-nudges` | Phase 2 for stale goals | QStash/cron-first; Redis Streams optional LAN — see PIVOT_EVENTS_AND_NUDGES |
| 4 | Intent classifier + prompt assembler | `feat/pivot-intent-prompts` | Phase 2–3 MVP | Rule-based v1; feature flag; keep slim/compact until parity |
| 5 | Cascading models | `feat/pivot-model-router` | Phase 4 | Defer until intent stable; respect user model override in preferences |
| 6 | Progressive summarization | `feat/pivot-context-summarize` | — | Parallel after trim baselines; keep `trim-context` as safety net |

**Rule:** Do not start phase **N+1** on an unmerged phase **N** branch (per external prompt).

## Conflicts addressed (summary)

- **Postgres FTS ADR (2026-01-15):** Primary path unchanged until pgvector Phase 1 merges with a refining ADR ([DECISIONS 2026-04-02](../DECISIONS.md)).
- **Mem0:** Optional semantic layer remains; hybrid strategy in ADR.
- **QStash:** Preferred for serverless nudges; Redis Streams optional for always-on hosts.

## v2 groundwork coupling

When schema or API surfaces change, update:

- [2026-04-01-v2-t4-memory-migration-blueprint.md](2026-04-01-v2-t4-memory-migration-blueprint.md)
- [2026-04-01-v2-t1-api-contract-for-python-backend.md](2026-04-01-v2-t1-api-contract-for-python-backend.md)

## Child tickets

- [2026-04-02-pivot-goals-layer-design.md](2026-04-02-pivot-goals-layer-design.md)
- [2026-04-05-scheduling-symbolic-grounding-spike.md](2026-04-05-scheduling-symbolic-grounding-spike.md) (v2 / research; not Phase 3 implementation)

## Phase 3 — Next slice engineering touchpoints (`feat/pivot-events-nudges`)

**Status:** Phase 2 (goals + tools) is shipped; Phase 3 is **event bus + notifications** per [PIVOT_EVENTS_AND_NUDGES.md](../PIVOT_EVENTS_AND_NUDGES.md). Use this list as a **concrete file/route checklist** when opening the branch (adjust names if the implementation ticket refines them).

| Area | Files / routes (expected) |
|------|---------------------------|
| Schema + migration | [`lib/db/schema.ts`](../../lib/db/schema.ts) — `Notification` (or equivalently named) table; new SQL under [`lib/db/migrations/`](../../lib/db/migrations/) |
| Queries | New module e.g. `lib/db/query-modules/notifications.ts`; export from [`lib/db/queries.ts`](../../lib/db/queries.ts) barrel |
| Stale signals | [`lib/db/query-modules/goals.ts`](../../lib/db/query-modules/goals.ts) — `getStaleGoalsForUser` (already present); extend or add producers for other event types per pivot doc |
| HTTP API | `app/api/notifications/route.ts` — `GET` (list pending), `PATCH` (dismiss / delivered / acted_on) matching stub contract in PIVOT doc |
| Async delivery | Mirror QStash/cron patterns: [`app/api/night-review/enqueue/route.ts`](../../app/api/night-review/enqueue/route.ts), [`app/api/digest/route.ts`](../../app/api/digest/route.ts); **note:** Vercel Hobby **two-cron limit** — new schedules may require self-hosted cron + `CRON_SECRET` (see [AGENTS.md](../../AGENTS.md#scheduled-jobs-on-the-host-no-vercel-cron)) |
| Chat context | [`app/(chat)/api/chat/route.ts`](../../app/(chat)/api/chat/route.ts) and/or companion prompt assembly — inject high-priority pending nudges when appropriate |
| UI | [`app/(chat)/layout.tsx`](../../app/(chat)/layout.tsx), [`components/chat/shell.tsx`](../../components/chat/shell.tsx) (or adjacent) — minimal dismissible banner per PIVOT doc |
| Optional LAN | Redis Streams consumer (Phase 3b) — same `Notification` rows as QStash path so [`GET /api/notifications`](../PIVOT_EVENTS_AND_NUDGES.md) stays one surface |

## Verification (per phase, when implemented)

- `pnpm check`, `pnpm build`, targeted tests as in external prompt.
- [AGENTS.md](../../AGENTS.md) Review + Handoff checklists.
- New ADR entries in [DECISIONS.md](../DECISIONS.md) for any superseding recall or schema SSOT change.
