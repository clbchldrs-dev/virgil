# OpenClaw bridge (optional execution layer)

Virgil keeps **goals, memory, and proactive logic** in this repo. [OpenClaw](https://github.com/openclaw/openclaw) (or a compatible gateway) can act as **hands**: messaging, shell, files, and skills on the LAN.

**Operator reference:** the always-on LAN host for this deployment is named **`virgil-manos`** (Ubuntu). Co-locate **Ollama** there and set **`OLLAMA_BASE_URL`** on the Virgil server for **local chat inference**. For **delegation**, prefer **`HERMES_*`** (Hermes first) and add **`OPENCLAW_*`** for OpenClaw as second-line / breadth; runtime routing and failover are documented in **[virgil-manos-delegation.md](virgil-manos-delegation.md)**. Delegation is not the primary chat LLM.

The bridge is **optional**. Delegation tools register when **`HERMES_HTTP_URL`** and/or **`OPENCLAW_URL`** / **`OPENCLAW_HTTP_URL`** is set ([lib/integrations/delegation-provider.ts](../lib/integrations/delegation-provider.ts)). Hermes alone is enough for `delegateTask` on Vercel when OpenClaw is proxied on `manos` (see below).

### Vercel production: do not expose OpenClaw to the internet

When Virgil is deployed on **Vercel**, leave **`OPENCLAW_*` unset** in project env. Expose **Hermes** only (e.g. **Cloudflare Tunnel** from `manos` to a public `https://hermes.<your-domain>`). On `manos`, register a **Hermes skill** that forwards to OpenClaw at `http://127.0.0.1:13100` so shell/files skills stay off the public internet. Virgil talks only to Hermes with **`HERMES_SHARED_SECRET`**. Gemini (or other cloud keys) can live in Hermes on `manos`; OpenClaw can use local-only inference. Full checklist: **[virgil-manos-delegation.md](virgil-manos-delegation.md)** — *Vercel production: Cloudflare Tunnel to Hermes only*.

This doc is **execution delegation** (optional LAN gateway). It is separate from **E6** in [ENHANCEMENTS.md](ENHANCEMENTS.md): E6 uses OpenClaw (and similar) **communities as a source of product ideas** for Virgil scope via `submitProductOpportunity` — not runtime execution through this bridge.

## Hermes as main driver (human steps)

Use this when you want Hermes to be the default delegation backend and keep OpenClaw as compatibility fallback.

1. Virgil's **in-app Hermes bridge** is the default — no separate process, no env wiring. The routes live at `app/api/hermes-bridge/{health,skills,execute,pending}` and the Next.js server talks to itself over loopback. To point delegation at a REMOTE Hermes instead, set in `.env.local`:
   - `VIRGIL_DELEGATION_BACKEND=hermes` (explicit override; default already prefers Hermes when reachable)
   - `HERMES_HTTP_URL=https://hermes.<your-domain>`
   - `HERMES_SHARED_SECRET=<secret>` (required off-loopback)
   Path overrides (`HERMES_*_PATH`) are only needed if the remote Hermes uses non-default routes.
2. Restart the app (`pnpm virgil:start` or `pnpm dev`) so the server reads updated env vars.
3. Keep `OPENCLAW_*` vars for OpenClaw compatibility; when **both** Hermes and OpenClaw are configured, Virgil **failovers** from Hermes to OpenClaw if Hermes is unreachable unless `VIRGIL_DELEGATION_FAILOVER=0`. See [virgil-manos-delegation.md](virgil-manos-delegation.md).
4. Sign in, then verify end-to-end:
   - `GET /api/delegation/health` confirms selected backend, online state, discovered skills, and queue depth.
   - `GET /api/openclaw/pending` confirms pending approvals and backlog behavior in the existing queue UI.
5. Run one safe delegated task first (for example a read-only status query) before enabling higher-risk skills.

## Hermes and Cursor: repository improvements

Virgil does **not** call the Cursor IDE over HTTP. `delegateTask` sends **ClawIntent** JSON to your **Hermes HTTP bridge** (`HERMES_HTTP_URL` + `HERMES_EXECUTE_PATH`). Cursor stays where **you** (or Cursor Agent) edit the repo. Wire three layers: Virgil env → Hermes host permissions → skills list.

### 1. Virgil (this app) — required env

In `.env.local` (restart `pnpm virgil:start` after edits):

| Variable | Purpose |
|----------|---------|
| `VIRGIL_DELEGATION_BACKEND` | Set `hermes` to force Hermes even when OpenClaw is also configured (optional; default already prefers Hermes when `HERMES_HTTP_URL` is set or the in-app bridge is resolvable). |
| `HERMES_HTTP_URL` | Optional explicit HTTP **origin** for a REMOTE Hermes, e.g. `https://hermes.example.internal`. Unset = use the in-app bridge (`/api/hermes-bridge/*`) in the same Next.js process. |
| `HERMES_EXECUTE_PATH` | Override when routing to a remote Hermes with non-default routes (default `/api/hermes-bridge/execute`). |
| `HERMES_PENDING_PATH` | Override (default `/api/hermes-bridge/pending`). |
| `HERMES_SKILLS_PATH` | Override (default `/api/hermes-bridge/skills`). |
| `HERMES_HEALTH_PATH` | Override (default `/api/hermes-bridge/health`). |
| `HERMES_SHARED_SECRET` | Shared bearer for `Authorization: Bearer …`. **Required** when Hermes is reachable off loopback (LAN, tunnel, VPS). Configure the **same** secret on the Hermes server. Loopback-only dev may omit it. |

Verify while signed in: `GET /api/delegation/health` should report the Hermes backend **online** and list **skills**. For a fuller feature-grouped snapshot run `pnpm virgil:status` or open `/api/virgil/status` in dev.

### 2. Hermes host — permissions for repo work

Configure the **machine where Hermes runs**, not Virgil’s `.env.local` alone:

- **Repo path:** A stable clone of the target repository (e.g. `virgil`) that Hermes skills or shell steps `cd` into before `git` / `pnpm`.
- **Git:** Credentials for `fetch` / `push` (SSH key or HTTPS + credential helper). Scope keys/PATs to **repo contents** (and **pull requests** if skills open PRs). Prefer automation keys separate from personal passwords.
- **Toolchain:** `node` / `pnpm` versions compatible with the repo (`AGENTS.md`, `package.json`) so delegated checks (`pnpm check`, `pnpm test:unit`) can succeed.
- **OS user:** The Hermes process should run as a normal user that **owns** the working tree; avoid root.
- **GitHub CLI (optional):** If skills use `gh`, run `gh auth login` on that host for the same identity you use for [`submitAgentTask`](../AGENTS.md) / issue workflows.

There is **no** `CURSOR_API_*` (or similar) variable in this repository. Cursor does not ship a supported remote API for Hermes to “drive Composer” headlessly. Typical flows:

- Hermes runs **git/shell/cron** in the repo; you **review in Cursor** on disk or via **GitHub** diff.
- For tracked product work, use **`submitAgentTask`** (gateway chat) and pick up tasks in Cursor per [AGENTS.md](../AGENTS.md) § Agent Task Pickup Convention.
- Large refactors stay **human- or Cursor-Agent-led** in the IDE; Virgil can delegate **narrow** automation to Hermes.

### 3. Hermes — skills for `delegateTask`

`GET HERMES_HTTP_URL` + `HERMES_SKILLS_PATH` should return skill metadata Virgil can match (see `lib/integrations/hermes-client.ts`). Expose ids that reflect repo operations you allow, e.g. read-only diagnostics vs branch/commit flows. Unknown skills still fall back to **`generic-task`** (`lib/ai/tools/delegate-to-openclaw.ts`). Keep destructive operations behind **Virgil confirmation** (`requiresConfirmation`) and/or Hermes-side guards.

### 4. Security recap

- Prefer **loopback** + **SSH tunnel** for remote Hermes instead of exposing an HTTP port broadly ([openclaw-ssh-tunnel-hardening.md](openclaw-ssh-tunnel-hardening.md)).
- Rotate **`HERMES_SHARED_SECRET`** if it leaks; never commit real secrets.

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

- **`embedViaDelegation`** (when delegation is configured and `VIRGIL_DELEGATION_EMBED_ENABLED` is not off): synchronous embedding for wiki / hybrid-search experiments. Virgil POSTs to the same execute endpoint as `delegateTask` with skill id `VIRGIL_DELEGATION_EMBED_SKILL` (default **`wiki-embed`**) and `params: { texts: string[] }`. The gateway should run Ollama (or another embedder) on the LAN host and return JSON shaped as `{ "embeddings": number[][], "model"?: string }` — one vector per text, same order. List **`wiki-embed`** (or your override) on `GET …/skills` when the gateway publishes a skill catalog. Vectors are padded or truncated to `EMBEDDING_DIMENSIONS` in Virgil for Postgres/pgvector comparison.
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
- **Vercel:** do not set public `OPENCLAW_*` URLs; use **Hermes-only** tunneling per [virgil-manos-delegation.md](virgil-manos-delegation.md).
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
- Vercel + `virgil-manos`: [docs/virgil-manos-delegation.md](virgil-manos-delegation.md) (Cloudflare Tunnel to Hermes only).
- Event mapping: [lib/integrations/openclaw-actions.ts](../lib/integrations/openclaw-actions.ts).
- Tunnel hardening runbook: [docs/openclaw-ssh-tunnel-hardening.md](openclaw-ssh-tunnel-hardening.md).
