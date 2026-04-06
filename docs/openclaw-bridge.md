# OpenClaw bridge (optional execution layer)

Virgil keeps **goals, memory, and proactive logic** in this repo. [OpenClaw](https://github.com/openclaw/openclaw) (or a compatible gateway) can act as **hands**: messaging, shell, files, and skills on the LAN.

**Operator reference:** the always-on LAN gateway for this deployment is named **`virgil-manos`** (Ubuntu). Co-locate **Ollama** on that host (or another LAN box) and set **`OLLAMA_BASE_URL`** on the Virgil server for **local chat inference**; use **`OPENCLAW_*`** here for **delegation**, not as a substitute for the chat LLM.

The bridge is **optional**. If `OPENCLAW_URL` / `OPENCLAW_HTTP_URL` is unset, delegation tools are not registered.

This doc is **execution delegation** (optional LAN gateway). It is separate from **E6** in [ENHANCEMENTS.md](ENHANCEMENTS.md): E6 uses OpenClaw (and similar) **communities as a source of product ideas** for Virgil scope via `submitProductOpportunity` — not runtime execution through this bridge.

## Environment

| Variable | Purpose |
|----------|---------|
| `OPENCLAW_URL` | WebSocket base (e.g. `ws://127.0.0.1:13100` when tunneled). Used to derive HTTP origin when `OPENCLAW_HTTP_URL` is omitted. |
| `OPENCLAW_HTTP_URL` | Optional explicit HTTP origin. Hardened default is `http://127.0.0.1:13100` (SSH local forward). |
| `OPENCLAW_EXECUTE_PATH` | POST path for intents (default `/api/execute`). |
| `OPENCLAW_SKILLS_PATH` | GET path for skill list (default `/api/skills`). |
| `OPENCLAW_HEALTH_PATH` | GET path for `ping()` (default `/health`). |

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
