# Virgil 1.1 full-feature release plan

**Status:** Planned  
**Date:** 2026-04-18  
**Scope:** Move from "bridge shipped" to "full-featured and operator-ready" 1.1.

This plan treats Virgil 1.1 as a **stability and capability program** across five milestones. It assumes the bridge baseline exists (Hermes/OpenClaw delegation paths, wiki scaffold, safety posture) and focuses on making 1.1 reliable in daily use.

Related:

- [docs/V1_1_IMPLEMENTATION_CHECKLIST.md](V1_1_IMPLEMENTATION_CHECKLIST.md)
- [docs/V1_1_TO_V2_EXECUTION_TIMELINE.md](V1_1_TO_V2_EXECUTION_TIMELINE.md)
- [docs/DECISIONS.md](DECISIONS.md)
- [docs/tickets/2026-04-18-v1-1-full-feature-program-overview.md](tickets/2026-04-18-v1-1-full-feature-program-overview.md)

## Release definition of done

Virgil 1.1 is considered full-featured when all five are true:

1. Hermes/OpenClaw delegation behaves predictably under fallback and approval flows.
2. LLM Wiki operations are repeatable, auditable, and useful across sessions.
3. Input surfaces (chat + ingest channels + Alexa MVP) are documented, testable, and low-friction.
4. Reliability/observability loops catch and localize failures quickly (jobs, cron, queue, traces).
5. Stability gate and docs parity are green for operator bootstrap and maintenance.

## Milestone map

| Milestone | Goal | Ticket |
|---|---|---|
| M1 | Delegation core hardening | [2026-04-18-v1-1-m1-delegation-core-hardening.md](tickets/2026-04-18-v1-1-m1-delegation-core-hardening.md) |
| M2 | Wiki memory production loop | [2026-04-18-v1-1-m2-wiki-memory-production-loop.md](tickets/2026-04-18-v1-1-m2-wiki-memory-production-loop.md) |
| M3 | Interaction surfaces and input loop | [2026-04-18-v1-1-m3-interaction-surfaces-input-loop.md](tickets/2026-04-18-v1-1-m3-interaction-surfaces-input-loop.md) |
| M4 | Reliability and observability hardening | [2026-04-18-v1-1-m4-reliability-observability-hardening.md](tickets/2026-04-18-v1-1-m4-reliability-observability-hardening.md) |
| M5 | Release readiness and operator handoff | [2026-04-18-v1-1-m5-release-readiness-operator-handoff.md](tickets/2026-04-18-v1-1-m5-release-readiness-operator-handoff.md) |

## Suggested execution order

1. **M1 first** — avoid layering channel/UI work over unstable delegation semantics.
2. **M2 second** — stabilize memory loop and retrieval before scaling capture paths.
3. **M3 third** — expand input loop once backend behaviors are consistent.
4. **M4 fourth** — tighten run-time reliability and diagnostic visibility.
5. **M5 last** — final sweep for docs/env/runbook parity and release evidence.

## Exit gates per milestone

- Code changes include tests for changed behavior.
- `pnpm run type-check` passes.
- Focused unit tests for touched area pass.
- No safety downgrades (approval floors, spend controls, audit traceability).
- Ticket acceptance criteria are checked off with links to artifacts.

## Program-level acceptance evidence

- `pnpm stable:check` passes on final branch.
- Operator can run through startup and maintenance using docs only:
  - `.env.example`
  - [AGENTS.md](../AGENTS.md)
  - integration runbooks under `docs/`
- One end-to-end weekly loop is demonstrated:
  - capture -> memory/wiki update -> delegated action proposal -> approval -> audit trace.
