# OpenClaw bridge (optional execution layer)

Virgil keeps **goals, memory, and proactive logic** in this repo. [OpenClaw](https://github.com/openclaw/openclaw) (or a compatible gateway) can act as **hands**: messaging, shell, files, and skills on the LAN.

The bridge is **optional**. If `OPENCLAW_URL` / `OPENCLAW_HTTP_URL` is unset, delegation tools are not registered.

This doc is **execution delegation** (optional LAN gateway). It is separate from **E6** in [ENHANCEMENTS.md](ENHANCEMENTS.md): E6 uses OpenClaw (and similar) **communities as a source of product ideas** for Virgil scope via `submitProductOpportunity` — not runtime execution through this bridge.

## Environment

| Variable | Purpose |
|----------|---------|
| `OPENCLAW_URL` | WebSocket base (e.g. `ws://192.168.1.10:3100`). Used to derive HTTP origin when `OPENCLAW_HTTP_URL` is omitted. |
| `OPENCLAW_HTTP_URL` | Optional explicit HTTP origin (e.g. `http://localhost:3100`) for REST calls. |
| `OPENCLAW_EXECUTE_PATH` | POST path for intents (default `/api/execute`). |
| `OPENCLAW_SKILLS_PATH` | GET path for skill list (default `/api/skills`). |
| `OPENCLAW_HEALTH_PATH` | GET path for `ping()` (default `/health`). |

Adapt paths to match your OpenClaw gateway’s real routes.

## Features

- **`delegateTask` / `approveOpenClawIntent` tools** (personal assistant, when configured).
- **`PendingIntent` Postgres queue** with confirmation for sensitive delegations.
- **`GET/PATCH /api/openclaw/pending`** for UI: list pending approvals, approve/reject.
- **`dispatchVirgilEventToOpenClaw`** in `lib/events/processors/openclaw-dispatcher.ts` for future event-bus wiring.

## Security

- Intents are scoped by **`userId`**; API routes require session auth.
- Destructive or outbound phrasing sets **`requiresConfirmation`** until the owner approves.

## Related

- ADR: [docs/DECISIONS.md](DECISIONS.md) (OpenClaw execution layer).
- Event mapping: [lib/integrations/openclaw-actions.ts](../lib/integrations/openclaw-actions.ts).
