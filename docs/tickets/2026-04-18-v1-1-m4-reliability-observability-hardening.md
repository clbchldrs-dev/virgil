# M4 — Reliability and observability hardening

**Status:** Done  
**Program:** [2026-04-18-v1-1-full-feature-program-overview.md](2026-04-18-v1-1-full-feature-program-overview.md)

## Objective

Improve operational confidence: failures should be visible, diagnosable, and recoverable without guesswork.

## Scope

- Validate and tighten:
  - background job SLAs and metrics endpoints
  - cron-triggered routes (digest, night review enqueue)
  - queue failure visibility and retry semantics
  - trace/cost logs used for postmortems
- Ensure docs capture operator recovery actions for common failures.

## Key files

- `app/api/metrics/job-slas/route.ts`
- `app/api/background/jobs/run/route.ts`
- `app/api/night-review/enqueue/route.ts`
- `app/api/digest/route.ts`
- `docs/operator-integrations-runbook.md`
- `docs/STABILITY_TRACK.md`

## Acceptance criteria

- Core background routes expose useful health/error signal for operators.
- Failure and retry behavior is documented for queue and cron paths.
- Trace/cost logging docs align with real route behavior and env flags.
- At least one "failure drill" scenario is documented (what to check, how to recover).

## Verification

- `pnpm run type-check`
- Focused unit tests for touched reliability routes/modules
- Manual cron auth check using `Authorization: Bearer $CRON_SECRET` on non-prod

## Progress notes (2026-04-18)

- Refactored digest reliability logic into `lib/reliability/digest-route-handler.ts` with explicit diagnostics payload:
  - `summary` counters for scanned/processed/skipped owners
  - failure counters for fetch/email/slack stages
  - `failures[]` list with `ownerId`, `stage`, and error message
- Updated `app/api/digest/route.ts` to use the shared handler and return structured JSON diagnostics instead of opaque `"OK"`.
- Added focused reliability tests:
  - `tests/unit/digest-route-handler.test.ts`
  - covers cron auth, healthy processing summary, and fetch/email/slack failure accounting
- Added an operator failure drill to `docs/operator-integrations-runbook.md`:
  - daily digest degradation scenario
  - ordered troubleshooting checks
  - concrete recovery actions
- Refactored night-review enqueue reliability path into `lib/reliability/night-review-enqueue-handler.ts` with structured diagnostics:
  - summary counters (`ownersScanned`, `guestOwnersSkipped`, `eligibleOwners`, `enqueued`, `publishFailures`)
  - explicit per-owner `failures[]` payload for publish issues
  - skip diagnostics preserved for disabled / off-peak / model gate cases
- Updated `app/api/night-review/enqueue/route.ts` to delegate to the shared enqueue handler.
- Added focused reliability tests:
  - `tests/unit/night-review-enqueue-handler.test.ts`
  - covers cron auth, off-peak skip behavior, and publish-failure diagnostics
- Added a second operator failure drill to `docs/operator-integrations-runbook.md`:
  - night-review enqueue backlog / publish failure scenario
  - ordered checks and recovery actions
- Verification run for reliability handlers:
  - `node --test --import tsx tests/unit/night-review-enqueue-handler.test.ts tests/unit/digest-route-handler.test.ts`
  - `pnpm run type-check`
- Refactored QStash worker-run route into `lib/reliability/background-job-run-handler.ts`:
  - structured errors for signing-key, signature, payload, and job execution failures
  - success payload includes processed `jobId`
- Updated `app/api/background/jobs/run/route.ts` to delegate to the shared run handler.
- Refactored SLA metrics route into `lib/reliability/job-slas-handler.ts`:
  - structured response with `summary`, `failures[]`, and per-kind `results`
  - per-kind fallback diagnostics (`note: "Insufficient data"`) preserved
- Updated `app/api/metrics/job-slas/route.ts` to delegate to the shared handler.
- Added focused reliability tests:
  - `tests/unit/background-job-run-handler.test.ts`
  - `tests/unit/job-slas-handler.test.ts`
  - plus combined reliability run including digest + night-review handlers
- Verification run for full reliability handler slice:
  - `node --test --import tsx tests/unit/background-job-run-handler.test.ts tests/unit/job-slas-handler.test.ts tests/unit/night-review-enqueue-handler.test.ts tests/unit/digest-route-handler.test.ts`
  - `pnpm run type-check`
- Added queue-worker failure drill + retry semantics to `docs/operator-integrations-runbook.md`:
  - covers signature/config/payload/job-execution failure triage
  - defines retry flow by canonical `jobId`
- Aligned trace/cost logging documentation with actual chat-route/env behavior:
  - updated `docs/STABILITY_TRACK.md` to reflect `V2_TRACE_LOGGING`, `V2_EVAL_LOGGING`, and `V2_COST_LOGGING` semantics and output files
  - documented gateway/gemini-only scope for `costs.jsonl`
- Manual cron auth drill on non-production dev host:
  - `GET /api/digest` without bearer -> `401`
  - `GET /api/digest` with bearer -> non-401 (`500` in local env due downstream config, confirming auth gate passed)
  - `GET /api/night-review/enqueue` without bearer -> `401`
  - `GET /api/night-review/enqueue` with bearer -> `200` (`skipped: true`, disabled)

## Acceptance status snapshot (2026-04-18)

- **Core background routes expose useful health/error signal:** Met (digest + night-review enqueue + background/jobs/run + metrics/job-slas now return structured diagnostics)
- **Failure and retry behavior documented for queue/cron paths:** Met (digest + night-review cron drills and background worker retry drill documented)
- **Trace/cost logging docs align with real route behavior and env flags:** Met (`docs/STABILITY_TRACK.md` updated to route-accurate logging semantics)
- **At least one failure drill documented:** Met (`docs/operator-integrations-runbook.md` digest + night-review drills)

## Closure notes (2026-04-18)

- M4 acceptance criteria are satisfied with structured diagnostics on core reliability routes, focused handler tests, explicit failure drills, and a manual cron auth drill.
- Remaining release work moves to M5 release-readiness and operator handoff.

## Out of scope

- New external workflow engines (Temporal/Hatchet) unless explicitly ADR'd.
