# Virgil 1.1 bootstrap: Hermes harness + LLM Wiki memory

This document scopes the bridge build for **Virgil 1.1** in the current repo.

## Goals

- Validate Hermes as the delegation harness in the current product shell.
- Add a compounding memory layer using a Karpathy-style LLM Wiki pattern.
- Preserve existing safety invariants (approval gates, escalation floors, spend limits, audit trail).

## Memory shape

Use the starter scaffold at [`workspace/wiki-starter/`](../workspace/wiki-starter/README.md):

- `raw/` immutable sources
- `wiki/` maintained markdown knowledge pages
- `schema/` operational constraints and lifecycle rules

## Bridge boundaries

- Keep current Next.js app and operator workflow intact.
- Treat OpenClaw as optional legacy compatibility while Hermes harness is introduced.
- Keep autonomous side-effect behavior gated by existing policy controls.

## Acceptance for 1.1

- Hermes path can execute delegated tasks without reducing current safety controls.
- Memory ingest/query/lint loops keep `wiki/index.md` and `wiki/log.md` consistent.
- At least one realistic daily workflow uses wiki memory and survives across sessions.

## Storage direction for operators

For the bridge and v2 handoff, wiki retrieval/storage direction is ADR-aligned:

- local self-hosted Postgres first
- hybrid search posture (`pgvector` + `tsvector`)
- Honcho evaluated against the same host-level Postgres footprint (shared instance or adjacent DB)
- scheduling escalation order: Hermes -> Postgres `SKIP LOCKED` queue -> Temporal only if still needed

See [`docs/DECISIONS.md`](DECISIONS.md) (2026-04-18 entry) for the accepted record.

## Sequencing

For date-based execution (today setup -> June Mac mini -> August tiiny.ai), use:
[`docs/V1_1_TO_V2_EXECUTION_TIMELINE.md`](V1_1_TO_V2_EXECUTION_TIMELINE.md).

For concrete PR order, adapter boundaries, env surface, and test slices, use:
[`docs/V1_1_IMPLEMENTATION_CHECKLIST.md`](V1_1_IMPLEMENTATION_CHECKLIST.md).
