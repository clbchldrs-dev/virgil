# Virgil 1.1 full-feature program overview (M1-M5)

**Status:** Done  
**Related plan:** [docs/1_1_RELEASE_PLAN.md](../1_1_RELEASE_PLAN.md)  
**Goal:** Drive Virgil 1.1 from bridge baseline to full-featured, stable daily operation.

## Why this exists

Virgil 1.1 bridge capabilities are present, but 1.1 still needs programmatic hardening across delegation, wiki memory operations, channel surfaces, reliability telemetry, and operator release readiness.

This ticket tracks the coordinated milestone set and completion evidence.

## Milestones

| Milestone | Ticket | Outcome |
|---|---|---|
| M1 | [2026-04-18-v1-1-m1-delegation-core-hardening.md](2026-04-18-v1-1-m1-delegation-core-hardening.md) | Stable delegation semantics with predictable fallback and approvals |
| M2 | [2026-04-18-v1-1-m2-wiki-memory-production-loop.md](2026-04-18-v1-1-m2-wiki-memory-production-loop.md) | Repeatable wiki ingest/query/lint/daily loop; retrieval direction aligned with ADR |
| M3 | [2026-04-18-v1-1-m3-interaction-surfaces-input-loop.md](2026-04-18-v1-1-m3-interaction-surfaces-input-loop.md) | Low-friction input loop across chat + ingest channels + Alexa MVP |
| M4 | [2026-04-18-v1-1-m4-reliability-observability-hardening.md](2026-04-18-v1-1-m4-reliability-observability-hardening.md) | Measurable reliability and diagnostics under routine operations |
| M5 | [2026-04-18-v1-1-m5-release-readiness-operator-handoff.md](2026-04-18-v1-1-m5-release-readiness-operator-handoff.md) | Release package: docs parity, env parity, and final verification artifacts |

## Dependencies and sequencing

- M1 blocks M3 and partially blocks M4.
- M2 should land before M3 channel-scale work that depends on memory quality.
- M4 requires M1 and M2 in place for meaningful SLA and failure attribution.
- M5 depends on all prior milestones.

## Program-level acceptance criteria

- [x] All five milestone tickets are merged or explicitly deferred with rationale.
- [x] `pnpm stable:check` passes after M5.
- [x] Final docs reflect implemented behavior:
  - [AGENTS.md](../../AGENTS.md)
  - [docs/DECISIONS.md](../DECISIONS.md)
  - operator runbooks under `docs/`
- [x] End-to-end evidence exists for:
  - capture input
  - memory/wiki update
  - delegated action proposal and approval
  - auditability of result

## Completion notes

- M1-M4 closed with ticket-level acceptance criteria marked complete.
- M5 closed with final stability gate and release checklist artifact:
  - [docs/1_1_RELEASE_CHECKLIST.md](../1_1_RELEASE_CHECKLIST.md)
