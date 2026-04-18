# M3 — Interaction surfaces and input loop

**Status:** Done  
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

## Progress notes (2026-04-18)

- Added explicit per-channel operator coverage for capture surfaces in `docs/operator-integrations-runbook.md`:
  - chat, general ingest, share target ingest, journal parse, email ingest, Alexa
  - each now lists auth/gating, smoke payload, and expected failure behavior
- Added a minimal input-loop metrics section to `docs/operator-integrations-runbook.md`:
  - capture volume/day
  - capture -> review conversion
  - capture -> act signal
  - observation points plus starter SQL queries
- Expanded `docs/alexa-channel.md` with an explicit expected-failure-behavior table (`403/401/500/400` cases).
- Updated `docs/integration-test-matrix.md` with explicit rows for:
  - share target ingest
  - journal parse ingest
  - Alexa channel (`CaptureIntent`, `StatusIntent`)
- Refactored input routes to use testable handler modules:
  - `lib/ingest/ingest-route-handler.ts` (backing `app/api/ingest/route.ts`)
  - `lib/ingest/share-route-handler.ts` (backing `app/api/ingest/share/route.ts`)
  - `lib/channels/alexa/route-handler.ts` (backing `app/api/channels/alexa/route.ts`)
- Added behavior tests (auth/gating/failure/success paths):
  - `tests/unit/ingest-route.test.ts` now exercises `handleIngestPost(...)`
  - `tests/unit/alexa-route.test.ts` now exercises `handleAlexaPost(...)` for `CaptureIntent` and `StatusIntent`
  - `tests/unit/ingest-share-route.test.ts` validates share-target route behavior (401/403/400/redirect success)
- Verification run for this slice:
  - `node --test --import tsx tests/unit/ingest-route.test.ts tests/unit/alexa-channel.test.ts tests/unit/alexa-route.test.ts tests/unit/ingest-share-route.test.ts`
  - `pnpm run type-check`
- Ran manual non-production smoke payloads against local dev server with channel flags enabled:
  - `POST /api/ingest` payload -> `500 ingest_misconfigured`
  - `POST /api/ingest/share` payload (no session) -> `401 unauthorized`
  - `POST /api/channels/alexa` (`CaptureIntent`, `StatusIntent`) -> `500 alexa_misconfigured`
  - `GET /api/journal/parse` (no bearer) -> `401 unauthorized`
  - `POST /api/ingest/email` unsigned payload -> `500 email_ingest_misconfigured`
- Manual smoke confirms documented failure-mode contracts are enforced when env/auth prerequisites are missing.
- Ran final manual smoke with temporary local non-production env wiring (route flags + throwaway ingest/alexa secrets + existing local `User.id`):
  - `POST /api/ingest` success payload -> `200` with persisted memory row
  - `POST /api/channels/alexa` `CaptureIntent` -> `200` speech response + persisted note
  - `POST /api/channels/alexa` `StatusIntent` -> `200` speech summary reflecting recent captures
  - `POST /api/ingest/share` without session -> `401 unauthorized`
  - `GET /api/journal/parse` without bearer -> `401 unauthorized`
  - `POST /api/ingest/email` unsigned payload -> `500 email_ingest_misconfigured`

## Acceptance status snapshot (2026-04-18)

- **Each input route feature-gated/auth-protected/documented:** Met (route-level behavior tests + manual smoke failure contracts + docs)
- **Alexa MVP intents runnable with docs:** Met (`CaptureIntent` and `StatusIntent` passed manual smoke + behavior tests)
- **Channel docs include smoke tests and expected failure behavior:** Met (`docs/operator-integrations-runbook.md`, `docs/alexa-channel.md`, `docs/integration-test-matrix.md`)
- **Input-loop metrics definition explicit in docs:** Met (`docs/operator-integrations-runbook.md` metrics section + starter queries)

## Closure notes (2026-04-18)

- M3 acceptance criteria are satisfied with route-level behavior tests, explicit operator docs, and manual non-production smoke evidence (success + expected failure-mode checks).
- Remaining release work moves to M4 reliability/observability hardening and M5 release-readiness handoff.

## Out of scope

- Full voice stack (STT/TTS streaming agents).
- Multi-user account-linking model for Alexa.
