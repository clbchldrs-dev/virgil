# M1 — Delegation core hardening

**Status:** Planned  
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

## Verification

- `pnpm run type-check`
- `pnpm test:unit tests/unit/delegation-provider.test.ts tests/unit/hermes-client.test.ts tests/unit/hermes-config.test.ts tests/unit/openclaw-actions.test.ts`

## Out of scope

- New delegation providers beyond Hermes/OpenClaw.
- Product-level autonomous policy changes.
