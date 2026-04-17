# Virgil 1.1 implementation checklist (Hermes harness + LLM Wiki)

Execution checklist for building the **Virgil 1.1 bridge** in this repo with small, reviewable PRs.

Use this with:

- [`docs/V1_1_HERMES_WIKI_BOOTSTRAP.md`](V1_1_HERMES_WIKI_BOOTSTRAP.md)
- [`docs/V1_1_TO_V2_EXECUTION_TIMELINE.md`](V1_1_TO_V2_EXECUTION_TIMELINE.md)

## Scope guardrails

- Keep current app shell and auth model.
- Preserve approval/escalation/audit constraints (no safety downgrade).
- Do not remove OpenClaw path during bridge rollout.
- Keep all Hermes integration behind explicit config gates.

## Adapter boundary (what to build first)

Create a provider interface so chat/tool code no longer knows backend-specific details.

### Target interface (concept)

- `proposeTask(input) -> intent`
- `executeApprovedIntent(input) -> result`
- `listPendingIntents(userId) -> intents`
- `getHealth() -> status`

### Existing OpenClaw touchpoints to wrap

- `lib/ai/tools/delegate-to-openclaw.ts`
- `lib/ai/tools/approve-openclaw-intent.ts`
- `lib/integrations/openclaw-client.ts`
- `lib/integrations/openclaw-actions.ts`
- `lib/integrations/openclaw-config.ts`
- `components/chat/openclaw-pending-banner.tsx`
- `app/(chat)/api/chat/route.ts`

## Proposed config surface (bridge-safe)

Add these as **new env vars** during implementation PRs:

- `VIRGIL_DELEGATION_BACKEND=openclaw|hermes` (default `openclaw`)
- `HERMES_HTTP_URL=` (e.g. `http://127.0.0.1:8765`)
- `HERMES_EXECUTE_PATH=/api/execute`
- `HERMES_PENDING_PATH=/api/pending`
- `HERMES_HEALTH_PATH=/health`
- `HERMES_SHARED_SECRET=` (optional if local-only; required for non-local)

Do not remove existing `OPENCLAW_*` vars until Hermes parity is proven.

## LLM Wiki integration checklist

Use scaffold at [`workspace/wiki-starter/`](../workspace/wiki-starter/README.md).

- Implement ingest routine:
  - read one source from `raw/`
  - update affected pages in `wiki/`
  - update `wiki/index.md`
  - append entry to `wiki/log.md`
- Implement query routine:
  - read `wiki/index.md` first
  - answer from wiki pages with provenance links
- Implement lint routine:
  - detect contradictions, stale claims, orphan pages
  - produce patch suggestions before auto-edits (start conservative)

## PR slices (recommended order)

### PR-0: Docs and flags only

- Add env table entries for proposed Hermes bridge vars in:
  - `.env.example`
  - `AGENTS.md` env sections
- Add feature-flag behavior docs (no runtime behavior changes).

### PR-1: Delegation provider abstraction

- Add provider interface and registry (`openclaw` implementation only).
- Route existing OpenClaw tool calls through provider interface.
- No Hermes runtime calls yet.

### PR-2: Hermes provider (read-only + health)

- Add Hermes provider skeleton.
- Implement `getHealth()` and config validation only.
- UI/banner indicates backend health and active backend.

### PR-3: Hermes propose/approve parity

- Implement intent proposal + approval execution path.
- Ensure existing approval gates remain enforced.
- Maintain existing pending intent UX and audit trail semantics.

### PR-4: Wiki memory loop MVP

- Add service for ingest/query/lint operations against `workspace/wiki-starter`.
- Add one constrained trigger path (`POST /api/wiki/ops`, gated by `VIRGIL_WIKI_OPS_ENABLED=1` + `Authorization: Bearer $CRON_SECRET`).
- Validate index/log consistency and provenance enforcement.

### PR-5: End-to-end workflow hardening

- Wire one real recurring workflow (daily planning or project sync).
- Add fallback behavior (backend unavailable -> keep intents queued, return `backend_offline`, no unsafe auto-fail loops).
- Add operator runbook for recovery and host failover.

Implementation note:

- Daily recurring workflow shipped as `GET /api/wiki/daily` (gated by `VIRGIL_WIKI_DAILY_ENABLED=1` + `Authorization: Bearer $CRON_SECRET`) which writes a daily review page and appends log/index artifacts.

## Test checklist per PR

- Unit tests for provider selection and config parsing.
- Regression tests for existing OpenClaw behavior when backend is `openclaw`.
- Safety tests proving no bypass of approval/escalation gates.
- Wiki tests:
  - ingest updates index and log
  - raw files are never mutated
  - provenance required for durable facts

## Done criteria for Virgil 1.1 bridge

- `VIRGIL_DELEGATION_BACKEND=hermes` works for at least one repeated workflow.
- OpenClaw path still functions when selected.
- No regression in safety controls.
- Wiki memory artifacts are useful across sessions and auditable.
