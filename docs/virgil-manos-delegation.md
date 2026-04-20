# virgil-manos — delegation (Hermes first, OpenClaw second)

**virgil-manos** is the operator reference host on the LAN (Ubuntu, always-on): **Ollama**, optional **Hermes** HTTP bridge, optional **OpenClaw** gateway. Virgil’s chat tools (`delegateTask`, `embedViaDelegation`, approvals) talk to **one primary** bridge chosen at runtime, with an **optional failover** to the other when both are configured.

## Routing rules (in-app)

1. **Primary backend** — `VIRGIL_DELEGATION_BACKEND` if set to `hermes` or `openclaw`. If **unset**, Virgil prefers **Hermes** when `HERMES_HTTP_URL` is set; otherwise **OpenClaw** when `OPENCLAW_*` is set.
2. **Failover** — When **both** Hermes and OpenClaw URLs are present in env, **`VIRGIL_DELEGATION_FAILOVER` defaults to on** (set to `0` / `false` / `off` to disable). If the primary does not respond to health `ping`, Virgil routes **send** operations to the secondary (Hermes ↔ OpenClaw). Skill lists for `delegateTask` / `embedViaDelegation` validation are the **union** of both catalogs when failover is enabled.
3. **Reachability** — `GET /api/delegation/health` reports per-bridge probes plus `delegationOnline` (true if **either** bridge answers when failover is on). Implement the same **`wiki-embed`** (or `VIRGIL_DELEGATION_EMBED_SKILL`) skill on whichever gateway you treat as primary for embeddings, or on **both** if you rely on failover.
4. **No per-intent backend switch** — Chat does not let users or the model pick “Hermes vs OpenClaw” per `delegateTask` call. Routing is **primary when up**, **secondary only when failover is enabled** and the primary fails health checks (see [`lib/integrations/delegation-provider.ts`](../lib/integrations/delegation-provider.ts)). The signed-in **Deployment** page (`/deployment`) summarizes this for operators.

### Operator visibility (app UI)

After sign-in, open **`/deployment`** to see delegation configuration, gateway reachability, failover on/off, poll-primary mode (if active), and a **skill id list** with a freshness indicator. Use **Refresh skills snapshot** to bypass the short server cache (~55s) after you change gateway tools or env. Under the hood this matches **`GET /api/deployment/capabilities`**; add **`?refresh=1`** for the same bypass (requires session). Implementation: `lib/deployment/capabilities.ts` + `lib/deployment/delegation-snapshot.ts`.

## Vercel production (recommended): database poll worker (no tunnel)

**Default story for hosted Virgil + LAN execution:** Virgil does **not** call your home network. It writes **`PendingIntent`** rows to Postgres; **Hermes** (or **Manos**) runs a small loop that **outbound**-only calls **`GET https://<your-app>/api/delegation/worker/claim`** with `Authorization: Bearer <secret>`, executes the skill locally, then **`POST /api/delegation/worker/complete`** with the same `ClawResult` shape as the HTTP bridge.

| Variable | Purpose |
|----------|---------|
| `VIRGIL_DELEGATION_POLL_PRIMARY` | Set to `1` so `delegateTask` enqueues to the DB bus instead of synchronous HTTP from Vercel. |
| `VIRGIL_DELEGATION_WORKER_SECRET` | Bearer token for worker routes (falls back to `HERMES_SHARED_SECRET` if unset). |
| `VIRGIL_DELEGATION_POLL_WAIT_MS` | Optional; `0` (default) returns immediately with a queued success message. Set to e.g. `15000` to block the chat tool until the worker completes or times out (capped at 60s). |

**Coexistence:** Leave **`HERMES_HTTP_URL`** unset on Vercel when using poll-only. For **local dev**, you can keep Hermes HTTP and omit `VIRGIL_DELEGATION_POLL_PRIMARY` so delegation still uses the synchronous HTTP path. Implementation: [`lib/db/query-modules/pending-intents.ts`](../lib/db/query-modules/pending-intents.ts), [`lib/integrations/delegation-poll-config.ts`](../lib/integrations/delegation-poll-config.ts).

### Run the poll worker on manos (or Mac)

The repo ships a loop that talks **outbound** to hosted Virgil and **inbound** only to loopback Hermes. The recommended way to run it is **`pnpm virgil:start`** — the orchestrator (`scripts/virgil-start.ts`) auto-spawns `scripts/delegation-poll-worker.ts` whenever `VIRGIL_DELEGATION_WORKER_BASE_URL` points at a **non-localhost** origin (plus a worker secret):

```bash
# Starts next dev + OpenClaw SSH tunnel (if OPENCLAW_SSH_HOST is set) + poll worker.
pnpm virgil:start
```

If you prefer to run only the poll loop (e.g. on a headless manos box where you don't need `next dev`), use the standalone script:

```bash
pnpm delegation:poll-worker
```

**Environment on the LAN host** (e.g. `~/.env.local` next to the repo, or systemd `EnvironmentFile=`):

| Variable | Purpose |
|----------|---------|
| `VIRGIL_DELEGATION_WORKER_BASE_URL` | Hosted app origin, e.g. `https://your-app.vercel.app` (no trailing slash). You can use `NEXT_PUBLIC_APP_URL` instead if already set. |
| `VIRGIL_DELEGATION_WORKER_SECRET` | Same bearer as **`VIRGIL_DELEGATION_WORKER_SECRET`** (or **`HERMES_SHARED_SECRET`**) on Vercel. |
| `HERMES_HTTP_URL` | Local Hermes, typically `http://127.0.0.1:8765`. |
| `HERMES_SHARED_SECRET` | If your Hermes bridge requires auth for `POST …/execute`, set the same value Hermes expects (can match the worker→Vercel secret or be different — Hermes config is separate from Virgil’s worker routes). |
| `HERMES_EXECUTE_PATH` | Optional; default `/api/execute` ([`lib/integrations/hermes-config.ts`](../lib/integrations/hermes-config.ts)). |
| `VIRGIL_DELEGATION_POLL_INTERVAL_MS` | Optional idle delay after an empty claim (default `5000`). |
| `VIRGIL_DELEGATION_WORKER_EXECUTE_TIMEOUT_MS` | Optional timeout for each Hermes execute (default `120000`). |

The worker **drains the queue**: after a successful claim/complete it immediately claims again without sleeping. Use **systemd**, **pm2**, or **tmux** if you want it always on.

## Vercel production (alternative): Cloudflare Tunnel to Hermes

Use this when **Virgil runs on Vercel** (phone / any PC) and **`virgil-manos`** stays on the LAN **and** you want Virgil to call Hermes over **inbound** HTTPS instead of the poll bus. Vercel cannot open `http://192.168.x.x` or `127.0.0.1` on your home network, so delegation needs a **public HTTPS** endpoint that terminates on **Hermes** only.

**Why Hermes-only on Vercel**

- **One tunnel, one secret.** Run **Cloudflare Tunnel** (`cloudflared`) on `manos` so `https://hermes.<your-domain>` forwards to `http://127.0.0.1:8765`. Set **`HERMES_SHARED_SECRET`** on Hermes and the same value in **Vercel Production** env. Virgil sends `Authorization: Bearer …` on health, execute, and skills requests ([lib/integrations/hermes-config.ts](../lib/integrations/hermes-config.ts)).
- **OpenClaw stays local.** Do **not** set `OPENCLAW_URL` / `OPENCLAW_HTTP_URL` on Vercel. Register a **Hermes skill** that calls OpenClaw at `http://127.0.0.1:13100` on `manos` (Hermes-side wiring, not this repo). Then OpenClaw is never exposed to the internet; Virgil only talks to Hermes. When OpenClaw is stopped (e.g. daytime), Hermes can return “skill unavailable” for OpenClaw-backed skills; chat still works via the AI Gateway.
- **Credentials stay on manos.** Hermes may hold **Gemini** (or other cloud) API keys for escalated reasoning; **OpenClaw** can use **local-only** tokens (e.g. Ollama on `manos`). Vercel’s only outbound delegation secret is **`HERMES_SHARED_SECRET`**.
- **Do not set `OLLAMA_BASE_URL` on Vercel** for delegation. The serverless runtime cannot reach LAN `:11434`. Local-model chat savings apply when you run **`pnpm dev`** (or self-host) and point `OLLAMA_BASE_URL` at `manos`.

**Vercel Production env (minimal)**

| Variable | Set to |
|----------|--------|
| `HERMES_HTTP_URL` | `https://hermes.<your-domain>` (tunnel hostname) |
| `HERMES_SHARED_SECRET` | Same random secret as Hermes |
| `VIRGIL_DELEGATION_BACKEND` | `hermes` |
| `HERMES_EXECUTE_PATH`, `HERMES_HEALTH_PATH`, `HERMES_SKILLS_PATH`, `HERMES_PENDING_PATH` | Defaults unless your bridge uses different paths |

Leave **`OPENCLAW_*` unset** on Vercel. **`VIRGIL_DELEGATION_FAILOVER`** is irrelevant when only Hermes is configured (failover requires both bridges in env; see [lib/integrations/delegation-provider.ts](../lib/integrations/delegation-provider.ts)).

### Step 1 — manos: expose Hermes with Cloudflare Tunnel

No inbound firewall rule on the router is required: `cloudflared` maintains an **outbound** connection to Cloudflare.

1. On Ubuntu, install `cloudflared` (see [Cloudflare docs](https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/) for the current package or binary).
2. `cloudflared tunnel login` — authorize once against your Cloudflare account (browser flow).
3. `cloudflared tunnel create virgil-manos` — note the tunnel **UUID**; credentials appear under `~/.cloudflared/`.
4. DNS:
   - **Recommended:** a hostname on a zone in Cloudflare, e.g. `hermes.<your-domain>`. Run  
     `cloudflared tunnel route dns virgil-manos hermes.<your-domain>`  
     (tunnel name must match step 3).
   - **Quick test only:** `cloudflared tunnel --url http://127.0.0.1:8765` yields a `*.trycloudflare.com` URL that **changes when the process restarts** — not for production.
5. Write `~/.cloudflared/config.yml`. Start from **[scripts/cloudflared-manos-config.example.yml](../scripts/cloudflared-manos-config.example.yml)** — set `tunnel`, `credentials-file`, `hostname`, and ensure `service` is `http://127.0.0.1:8765` (Hermes listening on loopback).
6. Install the daemon: `sudo cloudflared service install` then `sudo systemctl enable --now cloudflared` (exact service name may match your distro’s package).
7. From a device **off** the LAN, confirm Hermes responds (adjust path if your bridge differs):

```bash
curl -fsS -H "Authorization: Bearer <HERMES_SHARED_SECRET>" "https://hermes.<your-domain>/health"
```

### Step 2 — manos: Hermes auth and OpenClaw as a local hand

1. Set a strong **`HERMES_SHARED_SECRET`** in Hermes’ process environment (same value you use on Vercel). Virgil sends `Authorization: Bearer …` from [`lib/integrations/hermes-config.ts`](../lib/integrations/hermes-config.ts).
2. In **Hermes** (not this repo), register a skill that forwards to OpenClaw at `http://127.0.0.1:13100` (e.g. POST to `/api/execute` with your bridge’s contract). Virgil’s `delegateTask` only talks to Hermes; Hermes decides when to call OpenClaw.
3. **Credentials stay on manos:** optional **Gemini** (or other cloud) keys in Hermes for escalated steps; **OpenClaw** can use **local-only** inference (e.g. Ollama). Vercel only stores **`HERMES_SHARED_SECRET`** for delegation.
4. Optional: [Cloudflare Access](https://developers.cloudflare.com/cloudflare-one/) in front of the tunnel hostname — not required if the shared secret is sufficient for your threat model.

### Step 3 — Vercel: Production environment variables

Set in the Vercel project (**Production**; add **Preview** only if you want preview deployments to reach `manos`).

| Variable | Value |
|----------|--------|
| `HERMES_HTTP_URL` | `https://hermes.<your-domain>` |
| `HERMES_SHARED_SECRET` | Same secret as Hermes |
| `VIRGIL_DELEGATION_BACKEND` | `hermes` |
| `HERMES_EXECUTE_PATH` | `/api/execute` (or your bridge’s path) |
| `HERMES_HEALTH_PATH` | `/health` |
| `HERMES_SKILLS_PATH` | `/api/skills` |
| `HERMES_PENDING_PATH` | `/api/pending` |

**Do not set:** `OPENCLAW_URL`, `OPENCLAW_HTTP_URL`, `OLLAMA_BASE_URL` (Vercel cannot reach LAN Ollama; use local dev for cheap local chat). Omitting `OPENCLAW_*` keeps OpenClaw off the public internet.

### Step 4 — When manos or Hermes is down

- **Hermes reachable:** `GET /api/delegation/health` shows `probes.hermes.online: true` and `delegationOnline: true` when the primary ping succeeds.
- **Hermes down** (PC off, `cloudflared` stopped, or secret mismatch): `delegationOnline: false`. Normal chat still uses the AI Gateway; delegation tools return unavailable outcomes (see [docs/openclaw-bridge.md](openclaw-bridge.md)).
- **OpenClaw stopped on manos** while Hermes is up: Hermes may report specific skills unavailable; unaffected skills still work.

### Step 5 — Verify after deploy

1. Sign in to Virgil in the browser, then open **`/api/delegation/health`** on your production origin (session cookie required — the route returns `401` without auth).
2. With Hermes + tunnel healthy, expect JSON shaped like:

```json
{
  "backend": "hermes",
  "failoverEnabled": false,
  "configured": true,
  "delegationOnline": true,
  "probes": {
    "hermes": { "configured": true, "online": true, "skillCount": 0 },
    "openclaw": { "configured": false, "online": false, "skillCount": 0 }
  }
}
```

`skillCount` values depend on your `/api/skills` responses. With **`OPENCLAW_*` unset on Vercel**, `probes.openclaw.configured` is **`false`** — that is expected.

3. Stop Hermes or `cloudflared` on `manos`, reload `/api/delegation/health`, confirm `probes.hermes.online` and `delegationOnline` go **false**, then restore services and confirm recovery **without** redeploying Vercel.
4. In chat (hosted model path), run one low-risk **`delegateTask`** that Hermes advertises to confirm end-to-end routing.

## Recommended env (Mac / laptop running `pnpm dev`, tunnel or LAN to manos)

Use an SSH tunnel or private LAN URL; do not commit real hosts or secrets.

```bash
# Ollama on manos (chat savings)
OLLAMA_BASE_URL=http://<manos-lan-ip>:11434

# Hermes HTTP bridge on manos (primary delegation)
HERMES_HTTP_URL=http://127.0.0.1:8765
# After SSH: ssh -L 8765:127.0.0.1:8765 user@manos
HERMES_EXECUTE_PATH=/api/execute
HERMES_SKILLS_PATH=/api/skills
HERMES_HEALTH_PATH=/health
HERMES_PENDING_PATH=/api/pending
# HERMES_SHARED_SECRET=...   # if the bridge requires Bearer auth off-loopback

# OpenClaw on manos (breadth / compatibility fallback)
OPENCLAW_HTTP_URL=http://127.0.0.1:13100
# Or OPENCLAW_URL=ws://127.0.0.1:13100
OPENCLAW_EXECUTE_PATH=/api/execute
OPENCLAW_SKILLS_PATH=/api/skills
OPENCLAW_HEALTH_PATH=/health

# Explicit Hermes-first (optional; matches default when both are set)
VIRGIL_DELEGATION_BACKEND=hermes

# Failover on when both bridges are configured (optional; default behavior)
# VIRGIL_DELEGATION_FAILOVER=1

# Wiki / hybrid-search embeddings via delegation (same execute contract as delegateTask)
# VIRGIL_DELEGATION_EMBED_SKILL=wiki-embed
```

## Verification

- **Production (Vercel + tunnel):** follow **Step 5** above (`/api/delegation/health` requires a signed-in session).
- **Local dev:** same route with `pnpm dev`; you may set both `HERMES_*` and `OPENCLAW_*` — confirm `probes.*.online`, `failoverEnabled` when both are configured, and `delegationOnline`. Exercise `delegateTask` / `embedViaDelegation` after skills exist on the bridge.

## Related docs

- [openclaw-bridge.md](openclaw-bridge.md) — bridge contract, `wiki-embed`, env table
- [openclaw-ssh-tunnel-hardening.md](openclaw-ssh-tunnel-hardening.md) — loopback + SSH patterns
- [manos-performance.md](manos-performance.md) — Ollama latency tuning on the LAN host
- [scripts/cloudflared-manos-config.example.yml](../scripts/cloudflared-manos-config.example.yml) — example `config.yml` for Step 1
