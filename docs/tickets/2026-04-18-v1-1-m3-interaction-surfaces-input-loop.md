# M3 — Interaction surfaces and input loop

**Status:** Planned  
**Program:** [2026-04-18-v1-1-full-feature-program-overview.md](2026-04-18-v1-1-full-feature-program-overview.md)

## Objective

Increase usable capture throughput by tightening existing interaction surfaces and documenting a reliable operator path for each input channel.

## Scope

- Stabilize and document:
  - chat primary path
  - `/api/ingest` and `/api/ingest/share`
  - journal parse and inbound email ingest
  - Alexa channel webhook (`/api/channels/alexa`)
- Ensure UX and docs support a clear "capture -> review -> act" loop.
- Define and expose minimal input-loop metrics (capture volume and conversion signal).

## Key files

- `app/api/ingest/route.ts`
- `app/api/ingest/share/route.ts`
- `app/api/channels/alexa/route.ts`
- `docs/operator-integrations-runbook.md`
- `docs/alexa-channel.md`
- `docs/integration-test-matrix.md`

## Acceptance criteria

- Each input route is feature-gated, auth-protected, and documented.
- Alexa MVP intents (`CaptureIntent`, `StatusIntent`) are runnable with provided docs.
- Channel docs include smoke tests and expected failure behavior.
- Input-loop metrics definition is explicit in docs (what to measure, where to observe).

## Verification

- `pnpm run type-check`
- `pnpm test:unit tests/unit/ingest-route.test.ts tests/unit/alexa-channel.test.ts tests/unit/alexa-route.test.ts`
- Manual smoke test of at least one payload per channel in a non-production environment

## Out of scope

- Full voice stack (STT/TTS streaming agents).
- Multi-user account-linking model for Alexa.
