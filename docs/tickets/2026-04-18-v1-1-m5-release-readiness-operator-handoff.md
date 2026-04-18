# M5 — Release readiness and operator handoff

**Status:** Planned  
**Program:** [2026-04-18-v1-1-full-feature-program-overview.md](2026-04-18-v1-1-full-feature-program-overview.md)

## Objective

Ship 1.1 as an operator-ready package: green stability gate, coherent docs, and reproducible setup/maintenance workflows.

## Scope

- Final docs parity and drift cleanup across:
  - `AGENTS.md`
  - `.env.example`
  - key runbooks and architecture docs
- Final integration verification pass and release evidence collection.
- Produce explicit release checklist artifact for "go/no-go".

## Key files

- `AGENTS.md`
- `.env.example`
- `docs/1_1_RELEASE_PLAN.md`
- `docs/operator-integrations-runbook.md`
- `docs/DECISIONS.md`
- `docs/STABILITY_TRACK.md`

## Acceptance criteria

- `pnpm stable:check` passes on release candidate branch.
- Env var docs are complete for all shipped 1.1 integrations.
- Operator can bootstrap and validate critical paths using docs only.
- Program overview ticket is updated with completion state for M1-M5.

## Verification

- `pnpm stable:check`
- Release checklist run on clean environment using documented setup only

## Out of scope

- v2 backend implementation.
- Major new feature additions that are not part of M1-M4.
