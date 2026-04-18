# OpenClaw bridge (optional execution layer)

Virgil keeps **goals, memory, and proactive logic** in this repo. [OpenClaw](https://github.com/openclaw/openclaw) (or a compatible gateway) can act as **hands**: messaging, shell, files, and skills on the LAN.

**Operator reference:** the always-on LAN gateway for this deployment is named **`virgil-manos`** (Ubuntu). Co-locate **Ollama** on that host (or another LAN box) and set **`OLLAMA_BASE_URL`** on the Virgil server for **local chat inference**; use **`OPENCLAW_*`** here for **delegation**, not as a substitute for the chat LLM.

The bridge is **optional**. If `OPENCLAW_URL` / `OPENCLAW_HTTP_URL` is unset, delegation tools are not registered.

This doc is **execution delegation** (optional LAN gateway). It is separate from **E6** in [ENHANCEMENTS.md](ENHANCEMENTS.md): E6 uses OpenClaw (and similar) **communities as a source of product ideas** for Virgil scope via `submitProductOpportunity` — not runtime execution through this bridge.

## Hermes as main driver (human steps)

Use this when you want Hermes to be the default delegation backend and keep OpenClaw as compatibility fallback.

1. In `.env.local`, set:
   - `VIRGIL_DELEGATION_BACKEND=hermes` (explicit override)
   - `HERMES_HTTP_URL=http://<host>:8765`
   - `HERMES_EXECUTE_PATH=/api/execute`
   - `HERMES_HEALTH_PATH=/health`
   - `HERMES_SKILLS_PATH=/api/skills`
   - `HERMES_SHARED_SECRET=<secret>` (required off-loopback)
2. Restart the app (`pnpm dev`) so the server reads updated env vars.
3. Keep `OPENCLAW_*` vars only if you want fallback compatibility; remove them if you want hard-fail behavior when Hermes is down.
4. Sign in, then verify end-to-end:
   - `GET /api/delegation/health` confirms selected backend, online state, discovered skills, and queue depth.
   - `GET /api/openclaw/pending` confirms pending approvals and backlog behavior in the existing queue UI.
5. Run one safe delegated task first (for example a read-only status query) before enabling higher-risk skills.

## Environment

| Variable | Purpose |
|----------|---------|
| `OPENCLAW_URL` | WebSocket base (e.g. `ws://127.0.0.1:13100` when tunneled). Used to derive HTTP origin when `OPENCLAW_HTTP_URL` is omitted. |
| `OPENCLAW_HTTP_URL` | Optional explicit HTTP origin. Hardened default is `http://127.0.0.1:13100` (SSH local forward). |
| `OPENCLAW_EXECUTE_PATH` | POST path for intents (default `/api/execute`). |
| `OPENCLAW_SKILLS_PATH` | GET path for skill list (default `/api/skills`). |
| `OPENCLAW_HEALTH_PATH` | GET path for `ping()` (default `/health`). |
| `HERMES_SKILLS_PATH` | Hermes skills-list path used for delegation skill discovery (default `/api/skills`). |

Adapt paths to match your OpenClaw gateway’s real routes.

### Hardened baseline (recommended)

Use a local SSH tunnel and point Virgil at loopback:

- `OPENCLAW_HTTP_URL=http://127.0.0.1:13100`
- `OPENCLAW_URL=ws://127.0.0.1:13100` (optional, for consistency)

This keeps OpenClaw private on the remote host while Virgil talks only to a localhost forward.

## Features

- **`delegateTask` / `approveOpenClawIntent` tools** (personal assistant, when configured).
- **`PendingIntent` Postgres queue** with confirmation for sensitive delegations.
- **`GET/PATCH /api/openclaw/pending`** for UI: list pending approvals, approve/reject.
- **`dispatchVirgilEventToOpenClaw`** in `lib/events/processors/openclaw-dispatcher.ts` for future event-bus wiring.

### Normalized delegation outcome contract

Delegation tools and `PATCH /api/openclaw/pending` now share one outcome shape via:

- `lib/integrations/delegation-errors.ts`

Shared builders:

- `buildDelegationSkipFailure(...)`
- `buildDelegationQueuedSuccess(...)`
- `buildDelegationSendOutcome(...)`
- `delegationFailureStatusCode(...)`

Common skip failures:

| Error | Reason | Status (route) | Notes |
|---|---|---|---|
| `delegation_backend_offline` | `backend_offline` | `503` | Includes backend + queued backlog when available |
| `intent_awaiting_confirmation` | `awaiting_confirmation` | `409` | Confirmation gate still active |
| `intent_not_sendable` | `wrong_status` | `409` | Intent is not in a sendable state |

Execution failure from backend:

| Error | Reason | Status (route) | Notes |
|---|---|---|---|
| `delegation_execution_failed` | `execution_failed` | `200` with `ok: false` (tool/route outcome payload) | Backend responded but reported failure |

Success outcomes:

| Status | Meaning |
|---|---|
| `queued` | Intent accepted and queued (typically confirmation path) |
| `sent` | Intent was sent to backend; payload includes backend result |

## Security

- Intents are scoped by **`userId`**; API routes require session auth.
- Destructive or outbound phrasing sets **`requiresConfirmation`** until the owner approves.
- Prefer an **SSH local tunnel** from the Virgil host to the OpenClaw host so OpenClaw can stay bound to loopback on the remote machine (`127.0.0.1`) instead of being exposed broadly on your LAN.
- For a concrete operator runbook (Mac → Ubuntu LAN host, tunnel commands, hardening, verification), see [openclaw-ssh-tunnel-hardening.md](openclaw-ssh-tunnel-hardening.md) — includes owner reference for **`caleb-virgil1`** / **`caleb@192.168.1.81`**.

## Known limitations and operator notes

- **HTTP REST only.** `OPENCLAW_URL` accepts a `ws://` value but it is converted to HTTP; no live WebSocket connection is made. Set `OPENCLAW_HTTP_URL` directly if this is confusing.
- **Personal assistant mode only.** Tools are registered when `!isBusinessMode && isOpenClawConfigured()`. Business/front-desk mode does not expose delegation.
- **Execute/skills/health paths are assumptions.** Default paths (`/api/execute`, `/api/skills`, `/health`) may not match your OpenClaw release; override with `OPENCLAW_*_PATH` env vars.
- **No retry worker.** `getRetryableOpenClawIntents` (query for intents stuck in "sent" > 5 min) exists but has no cron/poller wired yet. Recovery is manual re-delegation.
- **Approve button disabled when offline.** If OpenClaw is unreachable, the UI prevents approval. Rejection is still allowed.
- **`production` build requires `POSTGRES_URL`.** This is an existing app constraint, not OpenClaw-specific.
- **Event-bus dispatcher is a stub.** `dispatchVirgilEventToOpenClaw` and the action mapping in `openclaw-actions.ts` will be active when E11 pivot event streams ship. The `delegationNeedsConfirmation` safety net runs on all event-built intents even when the mapping sets `requiresConfirmation: false`.

### Deferred (P2, acceptable for single-owner v1)

- No CSRF token on PATCH (mitigated by `SameSite=Lax` cookies).
- No per-endpoint rate limiting beyond session auth.
- No DB-level `CHECK` constraint on `status` column (enforced in TypeScript/Drizzle).
- No pagination on `GET /api/openclaw/pending` (backlog expected to stay small).
- Skills cache is process-global (not per-user); appropriate for single-owner.
- `matchSkillFromDescription` breaks ties by array order (deterministic but arbitrary).

## Related

- ADR: [docs/DECISIONS.md](DECISIONS.md) (OpenClaw execution layer).
- Event mapping: [lib/integrations/openclaw-actions.ts](../lib/integrations/openclaw-actions.ts).
- Tunnel hardening runbook: [docs/openclaw-ssh-tunnel-hardening.md](openclaw-ssh-tunnel-hardening.md).
