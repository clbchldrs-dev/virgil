# M1 — Delegation core hardening

**Status:** Done  
**Program:** [2026-04-18-v1-1-full-feature-program-overview.md](2026-04-18-v1-1-full-feature-program-overview.md)

## Objective

Make delegation predictable and safe across Hermes/OpenClaw backends, including fallback behavior, pending-intent handling, and approval execution semantics.

## Scope

- Normalize behavior for:
  - `delegateTask`
  - approval/execute path
  - pending intent listing and state transitions
- Ensure consistent error shapes and user-visible messaging when backend is offline/misconfigured.
- Ensure backend selection logic remains explicit and test-covered.

## Key files

- `lib/integrations/delegation-provider.ts`
- `lib/integrations/hermes-client.ts`
- `lib/integrations/hermes-config.ts`
- `lib/ai/tools/delegate-to-openclaw.ts`
- `lib/ai/tools/approve-openclaw-intent.ts`
- `app/api/hermes/execute/route.ts`
- `app/api/hermes/pending/route.ts`
- `app/(chat)/api/openclaw/pending/route.ts`

## Acceptance criteria

- Delegation backend selection is deterministic and unit-tested.
- Offline Hermes/OpenClaw returns safe, actionable failures (no silent drops).
- Approval-required actions remain approval-required regardless of backend.
- Pending queue operations remain auditable and idempotent enough for retries.
- Tests cover happy path and failure path for both backends.

## Acceptance status snapshot (2026-04-18)

| Criterion | Status | Evidence | Remaining to close |
|---|---|---|---|
| Delegation backend selection is deterministic and unit-tested | **Met** | `tests/unit/delegation-provider.test.ts` covers default, explicit override, and fallback behavior | None |
| Offline Hermes/OpenClaw returns safe, actionable failures (no silent drops) | **Met** | Shared skip-failure contract in `lib/integrations/delegation-errors.ts`; route/tool callers emit normalized `backend_offline` and related outcomes; `tests/unit/delegation-errors.test.ts` + `tests/unit/openclaw-pending-route-contract.test.ts` | None |
| Approval-required actions remain approval-required regardless of backend | **Met** | Confirmation gate remains in queue flow (`pendingIntentBlocksImmediateSend` path and `confirmPendingIntent` flow); route/tool contracts preserve awaiting-confirmation state; parity test added in `tests/unit/delegation-approval-gate-parity.test.ts` | None |
| Pending queue operations remain auditable and idempotent enough for retries | **Met** | `PendingIntent` status transitions and stored results remain intact; queue/backlog and pending confirmations exposed in route diagnostics; idempotency skip helper + tests (`lib/integrations/delegation-idempotency.ts`, `tests/unit/pending-intent-idempotency.test.ts`) plus stale-row retry gate coverage (`tests/unit/pending-intent-retry.test.ts`) are in place | None |
| Tests cover happy path and failure path for both backends | **Met** | Hermes/OpenClaw provider/client/config/action suites plus route contract checks are passing; route-level approve/send outcome flow tests cover both backends (`tests/unit/delegation-pending-route.test.ts`) | None |

## Verification

- `pnpm run type-check`
- `pnpm test:unit tests/unit/delegation-provider.test.ts tests/unit/hermes-client.test.ts tests/unit/hermes-config.test.ts tests/unit/openclaw-actions.test.ts`

## Progress notes (2026-04-18)

- Added backend-agnostic backlog naming in pending-intent queries (`countDelegationBacklogForUser`, with compatibility alias preserved).
- Normalized delegation skip failures and success payloads across:
  - `delegateTask`
  - `approveDelegationIntent` / `approveOpenClawIntent`
  - `PATCH /api/openclaw/pending`
- Added shared delegation outcome helpers in `lib/integrations/delegation-errors.ts`.
- Added/updated focused tests:
  - `tests/unit/delegation-errors.test.ts`
  - `tests/unit/openclaw-pending-route-contract.test.ts`
  - existing delegation/Hermes/openclaw suites

## Out of scope

- New delegation providers beyond Hermes/OpenClaw.
- Product-level autonomous policy changes.

## Closure notes

- M1 verification suite (focused delegation/Hermes/route/idempotency/retry tests) passes.
- `pnpm run type-check` passes after M1 slices.
