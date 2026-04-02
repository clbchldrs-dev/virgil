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
| 2 | Goal-state tracker + tools | `feat/pivot-goal-tracker` | Goals design ticket | Extend `GoalWeeklySnapshot`; add `Goal` / `GoalCheckIn` per design doc |
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

## Verification (per phase, when implemented)

- `pnpm check`, `pnpm build`, targeted tests as in external prompt.
- [AGENTS.md](../AGENTS.md) Review + Handoff checklists.
- New ADR entries in [DECISIONS.md](../DECISIONS.md) for any superseding recall or schema SSOT change.
