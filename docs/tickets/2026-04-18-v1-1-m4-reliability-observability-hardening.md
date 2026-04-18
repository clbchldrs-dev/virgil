# M4 — Reliability and observability hardening

**Status:** Planned  
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

## Out of scope

- New external workflow engines (Temporal/Hatchet) unless explicitly ADR'd.
