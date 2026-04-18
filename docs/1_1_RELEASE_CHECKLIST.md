# Virgil 1.1 release checklist (go/no-go)

**Status:** Go  
**Date:** 2026-04-18  
**Scope:** Final release-readiness gate for the 1.1 bridge program (M1-M5).

## Gate 1 — Stability check

- [x] `pnpm stable:check` passed.
- [x] Evidence captured: lint, type-check, and unit tests all green (`260` passing, `0` failing).

Command run:

```bash
pnpm stable:check
```

## Gate 2 — Milestone completion

- [x] M1 complete: delegation core hardening.
- [x] M2 complete: wiki memory production loop.
- [x] M3 complete: interaction surfaces/input loop + Alexa MVP channel.
- [x] M4 complete: reliability/observability hardening.
- [x] M5 complete: release-readiness and operator handoff.

Program tracker: [docs/tickets/2026-04-18-v1-1-full-feature-program-overview.md](tickets/2026-04-18-v1-1-full-feature-program-overview.md)

## Gate 3 — Docs and env parity

- [x] `.env.example` includes shipped 1.1 integration vars (delegation, wiki, ingest, Alexa, journal, email ingest).
- [x] `AGENTS.md` env var table mirrors shipped 1.1 routes and integration toggles.
- [x] ADR and architecture references are aligned for the 1.1 bridge and local wiki storage direction:
  - [docs/DECISIONS.md](DECISIONS.md)
  - [docs/V2_ARCHITECTURE.md](V2_ARCHITECTURE.md)
  - [workspace/wiki-starter/README.md](../workspace/wiki-starter/README.md)

## Gate 4 — Operator runbook completeness

- [x] Channel-by-channel input runbook is present with auth model, smoke payloads, and failure behavior:
  - [docs/operator-integrations-runbook.md](operator-integrations-runbook.md)
  - [docs/alexa-channel.md](alexa-channel.md)
- [x] Reliability failure drills are documented for digest, night-review enqueue, and background worker paths.
- [x] Integration test matrix includes channel + reliability surfaces:
  - [docs/integration-test-matrix.md](integration-test-matrix.md)

## Gate 5 — Release sign-off criteria

- [x] No new scope added outside M1-M4 implementation and M5 readiness closure.
- [x] Operator can execute bootstrap/maintenance path from docs and runbooks.
- [x] Release artifacts (plan, tickets, checklist) updated and cross-linked.

## Notes

- This checklist reflects release readiness for the current **Virgil 1.1 bridge** in this repository.
- v2 backend implementation remains explicitly out of scope for this release.
