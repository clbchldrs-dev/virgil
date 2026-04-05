# AGENTS.md -- Virgil: Local-First Personal AI Assistant

This file is for AI agents working on this codebase. Read it before making changes. For project intent, documentation map, architecture overview, and **new-chat handoff**, start with [docs/PROJECT.md](docs/PROJECT.md).

## What This Is

Virgil is a personal AI assistant built to run well on lightweight local models.

Default mode:

- personal assistant
- local-first
- proactive but honest
- cost-constrained by design

Optional:

- **Gateway-only** AutoGen-style orchestration: set `VIRGIL_MULTI_AGENT_ENABLED=1` to run a short internal planner pass before the main `streamText` (extra latency/cost; off by default). See `lib/ai/orchestration/`.

## North Star

Make Virgil as helpful as possible on 3B/7B-class local models without turning it into:

- a hosted-model-first product
- a bloated prompt stack
- a flattering or sycophantic assistant
- an expensive recurring service

## Core Product Priorities

1. Local-model usefulness
2. Cost minimization
3. Responsiveness and reliability
4. Honest, proactive assistance
5. Optional online deployment without changing the local-first default

## Personality Rules

Virgil should be:

- warm
- direct
- proactive
- practical
- honest about uncertainty and memory limits

Virgil should not be:

- sycophantic
- flattering for its own sake
- performatively agreeable
- overconfident about facts it cannot verify

If the user is wrong, unclear, or about to do something unhelpful, Virgil should push back briefly and respectfully.

## Default Behavior

- Personal assistant mode only (companion prompts and tools)
- Local Ollama models are the default path
- Hosted gateway models are optional and should stay secondary

## Architecture Notes

### Main route

- `app/(chat)/api/chat/route.ts`
- This is the primary integration point for:
  - prompt selection
  - tool selection
  - local vs hosted model routing
  - error handling

### Prompt layers

- `lib/ai/companion-prompt.ts` — full personal-assistant prompt
- `lib/ai/slim-prompt.ts` — slim local prompt variants
- `lib/ai/orchestration/` — optional gateway planner + executor (AutoGen-style pattern; not Python AutoGen)

### Model/provider layers

- `lib/ai/models.ts` — curated model roster, capabilities, presets, defaults
- `lib/ai/providers.ts` — AI Gateway and Ollama wiring
- `lib/ai/trim-context.ts` — local context budget discipline
- `lib/ai/local-title.ts` — local title generation without extra LLM calls

### Data and tools

- `@/lib/db/queries` — barrel export for all DB access (implementations in `lib/db/query-modules/`)
- `lib/db/schema.ts` — Drizzle schema
- `lib/ai/tools/` — one tool per file
- `lib/github/product-opportunity-issue.ts` — GitHub REST helper for gateway-only `submitProductOpportunity` ([docs/github-product-opportunity.md](docs/github-product-opportunity.md))
- `lib/github/agent-task-issue.ts` — GitHub REST helper for `submitAgentTask` (agent task issues)
- `lib/agent-tasks/` — background triage worker, config, schema, and prompts for agent task processing

## Local-First Rules

When choosing between two approaches, prefer the one that:

1. improves quality on local 3B/7B models
2. reduces or stabilizes prompt/context size
3. avoids extra inference calls
4. keeps recurring cost flat
5. preserves Virgil's voice and honesty

If a change helps large hosted models but makes the local path worse, assume it is the wrong default until proven otherwise.

## Docker And Online Use

Virgil should run in two primary ways:

1. `pnpm dev` for the normal local development loop
2. `docker compose up --build` for the one-command local stack

Docker details that matter:

- Default Compose includes a bundled **`ollama`** service; **`OLLAMA_BASE_URL`** is `http://ollama:11434` inside **`virgil-app`**. For host Ollama, use [`docker-compose.host-ollama.yml`](docker-compose.host-ollama.yml) and set `OLLAMA_BASE_URL` (e.g. `http://host.docker.internal:11434` on Docker Desktop)
- `AUTH_URL` must match the **browser origin** (e.g. `http://localhost:3000` on one machine, or `http://192.168.x.x:3000` on a LAN); pair with the same `NEXT_PUBLIC_APP_URL` and rebuild after changing the latter (see [Setup checklist § LAN](#access-from-another-device-on-your-lan-eg-gaming-pc-as-server))
- `shouldUseSecureAuthCookie()` exists to prevent cookie-prefix mismatches on plain HTTP

Online deployment should stay lightweight:

- Vercel Hobby
- Neon **or** Supabase free tier (Postgres)
- Upstash free tier
- Resend free tier
- AI Gateway optional

## Coding Guidance

- TypeScript strict mode
- Keep changes focused; do not refactor unrelated areas
- Prefer programmatic helpers over extra model calls when "good enough" is sufficient
- Keep local prompts short and high-signal
- Preserve existing abstractions unless they materially hurt the local-first goal

## File Conventions

- One tool per file in `lib/ai/tools/`
- Database access stays in `lib/db/queries.ts`
- Migrations remain raw SQL in `lib/db/migrations/`
- New env vars must be documented in:
  - `.env.example`
  - **This file** — [Setup checklist](#setup-checklist) and [Deployment (production)](#deployment-production)
  - Thin link hubs [SETUP.md](SETUP.md) and [DEPLOY.md](DEPLOY.md) (discoverability only; no duplicate tables)

## Setup checklist

Project root: this repository is typically cloned as **`virgil`** (the folder that contains `package.json`). Fill [`.env.local`](.env.local) first, then run migrations and the dev server.

**Shell paths:** Any `cd …/virgil` or `/path/to/virgil` in this doc is **not** a real filesystem path—substitute **your** clone directory (for example `~/Documents/virgil` if you cloned into `Documents`). If `cd` says “no such file,” you used the placeholder literally or the repo lives elsewhere.

## Graceful local start (before `.env.local` is complete)

- **`pnpm dev`** can start with **no `AUTH_SECRET`**: the app uses a **dev-only insecure JWT secret** and prints a one-time warning (`lib/auth-secret.ts`). Set `AUTH_SECRET` as soon as you care about session security or before sharing your machine.
- **Database and Redis** are still required for real login, chat persistence, and rate limits. Without `POSTGRES_URL` / `REDIS_URL`, pages that hit the DB will error — that is expected until Step 1–3 are done.
- **Preflight (optional):** `pnpm dev:check` lists what is missing; `pnpm dev:check:strict` exits with an error if `POSTGRES_URL` or `REDIS_URL` is absent (useful in scripts).
- **`next build` / production** always require a real **`AUTH_SECRET`** (or `NEXTAUTH_SECRET`); there is no fallback when `NODE_ENV=production`.

---

## Step 1 — Fill credentials in `.env.local`

Do these in order. Paste each value on **one line** with no spaces around `=`.

### 1.1 `AUTH_SECRET`

1. Open Terminal.
2. Run: `openssl rand -base64 32`
3. Copy the entire output (one line).
4. Paste after `AUTH_SECRET=` in `.env.local` (no quotes unless the secret contains special characters that break the file—usually no quotes needed).

### 1.2 `POSTGRES_URL` (Neon **or** Supabase)

Use any standard Postgres provider. Two tested options:

**Option A — Neon (free tier)**

1. Go to [Neon Console](https://console.neon.tech) and sign up / log in.
2. **Create project** (pick a region close to you).
3. Open the project → find **Connection string** (or **Connect**).
4. Copy the URI that starts with `postgres://` or `postgresql://`.
5. If Neon shows a **pooled** connection for serverless, prefer that for Vercel/Next.js.
6. Paste into `.env.local` after `POSTGRES_URL=`.

**Option B — Supabase (free tier)**

1. Go to [Supabase Dashboard](https://supabase.com/dashboard) and sign up / log in.
2. **New project** → pick a region close to you → set a database password.
3. Open the project → **Settings → Database** (or **Connect**).
4. Copy the **transaction pooler** URI (port `6543`) for the app at runtime.
5. Paste into `.env.local` after `POSTGRES_URL=`.
6. For **migrations only** (`pnpm db:migrate`), use the **direct** connection string (port `5432`) — the pooler may reject DDL statements. You can pass it inline: `POSTGRES_URL='postgresql://...:5432/...' pnpm db:migrate`.

### 1.3 `REDIS_URL` (Upstash)

1. Go to [Upstash Console](https://console.upstash.com) and sign up / log in.
2. **Create database** → Redis → pick a region.
3. Open the database → **Connect** (or **REST API** tab area).
4. Copy the **Redis URL** that starts with `rediss://` (TLS).  
   **Important:** Use the standard Redis protocol URL, **not** the REST endpoint URL.
5. Paste into `.env.local` after `REDIS_URL=`.

### 1.4 `BLOB_READ_WRITE_TOKEN` (Vercel Blob)

**Option A — you already have a Vercel project**

1. [Vercel Dashboard](https://vercel.com/dashboard) → your team → **Storage** → **Blob**.
2. Create a store if needed; open it and find **Environment Variables** / quickstart for `.env.local`.
3. Copy `BLOB_READ_WRITE_TOKEN=...` value only into `.env.local`.

**Option B — local-only first**

1. Install CLI: `npm i -g vercel` then `vercel login` and `vercel link` from this repo.
2. Add Blob from the dashboard for that project, then copy the token as above.

### 1.5 `AI_GATEWAY_API_KEY` (local dev)

1. Open [AI Gateway docs](https://vercel.com/docs/ai-gateway) and use the dashboard link to enable AI Gateway for your Vercel account if prompted.
2. In Vercel → **AI** / **AI Gateway** → create or view an **API key** for local use.
3. Paste into `.env.local` after `AI_GATEWAY_API_KEY=`.

### 1.6 `QSTASH_TOKEN` + signing keys (Upstash QStash)

1. In the [Upstash Console](https://console.upstash.com), go to **QStash** (same account as Redis).
2. Open the **Details** tab.
3. Copy **QSTASH_TOKEN**, **QSTASH_CURRENT_SIGNING_KEY**, and **QSTASH_NEXT_SIGNING_KEY**.
4. Paste each into `.env.local`.

### 1.7 `RESEND_API_KEY` (Resend)

1. Go to [Resend](https://resend.com) and sign up / log in.
2. Go to **API Keys** → **Create API Key** (full access or sending only).
3. Copy the key and paste into `.env.local` after `RESEND_API_KEY=`.

### 1.8 `CRON_SECRET`

1. Run: `openssl rand -base64 32`
2. Paste into `.env.local` after `CRON_SECRET=`.
3. When deploying, set this same value in Vercel env vars so the cron endpoint is protected.

### 1.9 Night review (optional)

Scheduled **night review** uses a larger model to analyze the last 24 hours of chat (rollup + excerpts), guided by Markdown under [`workspace/night/`](workspace/night/) (`HEARTBEAT.md`, `SOUL.md`, `SKILLS.md`) — same *idea* as [OpenClaw heartbeat / workspace files](https://docs.openclaw.ai/gateway/heartbeat) and [NemoClaw workspace layout](https://docs.nvidia.com/nemoclaw/latest/workspace/workspace-files.html), implemented inside Virgil only.

1. **Vercel production:** night review is **on by default** when `NIGHT_REVIEW_ENABLED` is unset (so the `vercel.json` cron is not a no-op). Set **`NIGHT_REVIEW_ENABLED=0`** to turn it off. **Local, preview, and self-hosted:** set **`NIGHT_REVIEW_ENABLED=1`** when you want the enqueue/worker path to run.
2. Set **`NIGHT_REVIEW_MODEL`** only to an allowed id: **`ollama/…`** (local; Ollama must be reachable from the worker) or **`google/…`** (Gemini — bills your Google AI key, not Vercel AI Gateway). Example hosted: `NIGHT_REVIEW_MODEL=google/gemini-2.5-flash-lite` plus **`GOOGLE_GENERATIVE_AI_API_KEY`** from [Google AI Studio](https://aistudio.google.com/apikey). DeepSeek, Mistral, and other gateway-only ids are **blocked** for night review to limit token spend.
3. Optional: **`NIGHT_REVIEW_STAGGER_SECONDS`** (default `60`) spaces QStash deliveries per owner. **`NIGHT_REVIEW_TIMEZONE`** (default `UTC`) defines the calendar **`windowKey`** for idempotency (one completed run per user per local date).
4. **Cron:** Vercel Cron calls **`GET /api/night-review/enqueue`** with `Authorization: Bearer $CRON_SECRET` (see [`vercel.json`](vercel.json), `0 3 * * *` UTC). Self-hosted: use the same request from `cron` or Task Scheduler against your public base URL.
5. The enqueue endpoint publishes one **QStash** message per **eligible user** (non-guest with **at least one chat** — same rule as the daily digest). Each message hits **`POST /api/night-review/run`** (signed). Findings are stored as **`Memory`** rows with `metadata.source = "night-review"`; completion rows use `metadata.phase = "complete"` for deduplication. Each run also appends a row to **`NightReviewRun`** (duration, outcome, model id).
6. **Optional email** when there are findings: set **`NIGHT_REVIEW_EMAIL_ON_FINDINGS=1`** (requires `RESEND_API_KEY`). **In-app:** `GET /api/memories/night-review?days=14` (authenticated) returns recent night-review memories for a “Night insights” UI.
7. **Tool egress:** HTTP from tools uses **`AGENT_FETCH_ALLOWLIST_HOSTS`** (comma-separated hostnames); default allows Open-Meteo hosts used by weather. Extend the list when adding new fetch-based tools.
8. **Quota:** each eligible user costs **one QStash message per night** in addition to reminders. The free tier is **500 messages/day** on Upstash.

### Step 1 sanity check

- [ ] All nine variables have non-empty values (no trailing spaces).
- [ ] `POSTGRES_URL` is a single connection string.
- [ ] `REDIS_URL` starts with `rediss://` (typical for Upstash).
- [ ] `QSTASH_TOKEN` starts with `ey` (it's a JWT).
- [ ] `RESEND_API_KEY` starts with `re_`.

---

## Step 2 — Install dependencies (if you have not already)

From a terminal, `cd` into **the repository root** (the directory that contains `package.json`). Example if your clone is `~/Documents/virgil`:

```bash
cd ~/Documents/virgil
corepack enable && corepack prepare pnpm@10.32.1 --activate
pnpm install
```

(Replace `~/Documents/virgil` with wherever you cloned the project.)

---

## Step 3 — Run database migrations

With `POSTGRES_URL` set in `.env.local`:

```bash
pnpm db:migrate
```

This applies `lib/db/migrations/`.

### Optional — GitHub product opportunities (gateway models)

If you want Virgil (when using **hosted gateway models**, not local Ollama) to open **GitHub Issues** for product feedback, set `GITHUB_REPOSITORY` and `GITHUB_PRODUCT_OPPORTUNITY_TOKEN` as in [docs/github-product-opportunity.md](docs/github-product-opportunity.md). Add the same keys to `.env.docker` if you use Docker.

---

## Docker Compose (Postgres + Redis + Ollama + app in one command)

Use this when you want a **single runnable stack** on your machine (no local Postgres/Redis/Ollama install). The default **[`docker-compose.yml`](docker-compose.yml)** runs **`postgres`**, **`redis`**, **`ollama`**, and **`virgil-app`**. The app container talks to Ollama at **`http://ollama:11434`** unless you override **`OLLAMA_BASE_URL`** in `.env.docker`. You still need a normal **`.env.docker`** for API keys the app expects at runtime (same values as `.env.local` for AI Gateway, Blob, etc.).

**Desktop-style launcher (checks Docker, bootstraps `.env.docker`, starts Compose, opens the browser):** see **[packaging/README.md](packaging/README.md)** — `packaging/launch-virgil.sh` / `launch-virgil.ps1`, or `pnpm launch:desktop`. Background schedules and QStash limits for pure local Docker are documented there.

**Host Ollama instead of the bundled container** (e.g. GPU on Docker Desktop): use **`docker compose -f docker-compose.host-ollama.yml up --build`** and set **`OLLAMA_BASE_URL`** in `.env.docker` — see the header in [`docker-compose.host-ollama.yml`](docker-compose.host-ollama.yml).

1. Install **Docker** with Compose v2 ([Docker Desktop](https://www.docker.com/products/docker-desktop/) on Windows/macOS, or [Docker Engine](https://docs.docker.com/engine/install/) on Linux) and keep the daemon running.
2. From the project root:
   ```bash
   cp .env.docker.example .env.docker
   ```
3. Edit **`.env.docker`**: set **`AUTH_SECRET`** (`openssl rand -base64 32`), **`AI_GATEWAY_API_KEY`**, **`BLOB_READ_WRITE_TOKEN`**, and any other vars from Step 1 that your features need.
4. **Pull Ollama models** into the bundled container (example tags; adjust to the models you use):
   ```bash
   docker compose up -d ollama postgres redis
   docker compose exec ollama ollama pull qwen2.5:3b
   docker compose exec ollama ollama pull qwen2.5:7b-instruct
   ```
5. Build and start the full stack:
   ```bash
   docker compose up --build
   ```
6. Open **http://localhost:3000** (use **`localhost`**, not `127.0.0.1`, so it matches `AUTH_URL` and session cookies apply). Migrations run automatically on container start; Postgres data lives in the **`pgdata`** Docker volume; Ollama weights live in **`ollama_data`**.
7. **Optional — warm-load the default local model** (keeps weights resident): `pnpm warmup:ollama` with **`OLLAMA_BASE_URL=http://127.0.0.1:11434`** (Compose publishes Ollama on the host). Optional **`WARMUP_MODEL`** selects the id (defaults to `DEFAULT_CHAT_MODEL`). See [`scripts/warmup-ollama.sh`](scripts/warmup-ollama.sh).

### Access from another device on your LAN (e.g. gaming PC as server)

**Short runbook (checklist, firewall, verification):** [docs/beta-lan-gaming-pc.md](docs/beta-lan-gaming-pc.md).

The app listens on **all interfaces** inside the container (`HOSTNAME=0.0.0.0`); port **3000** is enough for the LAN if your firewall allows inbound TCP 3000 on the host.

1. Pick the server machine’s **LAN IP** (e.g. `192.168.1.50`). Prefer a **DHCP reservation** or static address so the URL does not change.
2. Set **`AUTH_URL`** and **`NEXT_PUBLIC_APP_URL`** to the **exact origin** clients will use — same host, port, and scheme (plain HTTP is fine on a trusted LAN):
   - Add a **project-root `.env`** file (gitignored; Compose loads it automatically for variable substitution):
     ```bash
     AUTH_URL=http://192.168.1.50:3000
     NEXT_PUBLIC_APP_URL=http://192.168.1.50:3000
     ```
     Or put the same keys in **`.env.docker`** and start with  
     `docker compose --env-file .env.docker up --build`  
     so Compose picks them up for substitution.
3. **Rebuild** the app image after changing `NEXT_PUBLIC_APP_URL` (`docker compose up --build`), because Next inlines that value at build time.
4. On the **server**, the **bundled** Ollama service is reachable from **`virgil-app`** at **`http://ollama:11434`** by default. If you use **`docker-compose.host-ollama.yml`** or host-installed Ollama, set **`OLLAMA_BASE_URL`** in `.env.docker` accordingly (e.g. `http://host.docker.internal:11434` on Docker Desktop). If Ollama runs on a **different** machine, set `OLLAMA_BASE_URL` to `http://<ollama-host>:11434` and open **11434** on that host if needed.
5. Open **`http://<server-lan-ip>:3000`** from phones or other PCs — not `localhost` on those clients.

**Bundled Ollama (default `docker-compose.yml`):** no host install; use `docker compose exec ollama ollama pull …` for weights.

**Host Ollama:** set `OLLAMA_BASE_URL` (e.g. `http://host.docker.internal:11434`) and use [`docker-compose.host-ollama.yml`](docker-compose.host-ollama.yml) if you are not using the bundled `ollama` service.

**Not a single `.exe`:** Docker is the portable “run everywhere” packaging for this stack. True native `.app` / `.exe` bundles would still embed or assume Docker (or a large Node + DB installer) under the hood.

---

## Scheduled jobs on the host (no Vercel Cron)

[Vercel Cron](https://vercel.com/docs/cron-jobs) (see [`vercel.json`](vercel.json)) triggers two **GET** routes with **`Authorization: Bearer $CRON_SECRET`**:

| Job | Path | Schedule (UTC) |
|-----|------|----------------|
| Night review enqueue | `/api/night-review/enqueue` | 03:00 (`0 3 * * *`) |
| Daily digest | `/api/digest` | 08:00 (`0 8 * * *`) |

**Requirements**

- The running app must have **`CRON_SECRET`** set to the same value you send in the header.
- **`NEXT_PUBLIC_APP_URL`** must be the base URL the server uses for **absolute links** when **not** on Vercel (see `getBaseUrl()` in `app/api/night-review/enqueue/route.ts`). Use the same origin users type in the browser (e.g. `http://192.168.1.50:3000` on a LAN). Rebuild after changing `NEXT_PUBLIC_APP_URL`.
- Use **UTC** for cron times to match `vercel.json`, or set `CRON_TZ=UTC` in crontab. Keep **time sync** on (`systemd-timesyncd` on Ubuntu).

**`crontab` example** (adjust `APP_URL`; keep the secret out of world-readable files in production):

```bash
APP_URL='http://192.168.1.50:3000'
CRON_SECRET='(same value as in .env.docker / process env)'

0 3 * * * curl -fsS -H "Authorization: Bearer $CRON_SECRET" "$APP_URL/api/night-review/enqueue"
0 8 * * * curl -fsS -H "Authorization: Bearer $CRON_SECRET" "$APP_URL/api/digest"
```

**`systemd` example** — `virgil-night-enqueue.service` + `virgil-night-enqueue.timer` (mirror for digest at 08:00 UTC). Put `CRON_SECRET=…` and `APP_URL=…` in `/etc/virgil/cron.env` (`chmod 600`).

`/etc/systemd/system/virgil-night-enqueue.service`:

```ini
[Unit]
Description=Virgil night-review enqueue (curl)

[Service]
Type=oneshot
EnvironmentFile=/etc/virgil/cron.env
ExecStart=/usr/bin/curl -fsS -H "Authorization: Bearer ${CRON_SECRET}" "${APP_URL}/api/night-review/enqueue"
```

`/etc/systemd/system/virgil-night-enqueue.timer`:

```ini
[Unit]
Description=Run Virgil night-review enqueue daily (UTC)

[Timer]
OnCalendar=*-*-* 03:00:00
Persistent=true

[Install]
WantedBy=timers.target
```

Then: `systemctl daemon-reload && systemctl enable --now virgil-night-enqueue.timer`. Use `timedatectl` if the host is not UTC and you want calendar times interpreted in local time — prefer matching **`vercel.json`** with a UTC `OnCalendar` or set the timer unit `Timezone=UTC` (systemd 242+).

**LAN IP / firewall / sleep:** [docs/beta-lan-gaming-pc.md](docs/beta-lan-gaming-pc.md).

---

## Step 4 — Start the app locally

```bash
pnpm dev
```

Open the URL shown (usually `http://localhost:3000`). Register or use guest login.

### Ollama (local Qwen in the model picker)

Ollama must be running (`ollama serve` or the app menu service) and each model **pulled** before chat. Tags must match the base runtime tags exactly:

```bash
ollama pull qwen2.5:3b
ollama pull qwen2.5:7b-instruct
```

The picker now includes four curated local entries:

- `ollama/qwen2.5:3b`
- `ollama/qwen2.5:3b-turbo`
- `ollama/qwen2.5:7b-instruct`
- `ollama/qwen2.5:7b-lean`

The `-turbo` and `-lean` entries are presets only. They resolve to the same pulled Ollama tags above with tighter context/output settings.

Check with `ollama list`. If you see **`model '…' not found`**, the weights for that runtime tag are missing. Run `ollama pull` for the base tag shown in the error.

Remote Ollama (e.g. gaming PC on LAN): set `OLLAMA_BASE_URL` in `.env.local` to `http://<host>:11434` and ensure that machine has pulled the same tags.

Smoke test the live Ollama path:

```bash
pnpm ollama:smoke
```

To test one preset only:

```bash
pnpm ollama:smoke ollama/qwen2.5:3b-turbo
```

Each pass prints **first-token latency** (`first_token_ms`), **total wall time** (`total_ms`), the **streaming window** (`stream_window_ms`, first token → finish), and **tokens/sec** using provider `output_tokens` when Ollama reports them, otherwise a **~estimated** count (`ceil(chars / 3.5)` matching the local trim heuristic). Compare `output_tokens_per_s_wall` (includes queue + TTFT) vs `output_tokens_per_s_stream` (generation-only).

---

## Step 5 — Optional demo data

```bash
pnpm db:seed
```

Creates a demo user (see `lib/db/seed.ts`). Use only on a dev database.

---

## Step 6 — Deploy to Vercel (when ready)

1. Push the repo to GitHub (or use Vercel CLI `vercel link`).
2. **Import** the repo in Vercel → set the same env vars in **Project → Settings → Environment Variables** (except you often **omit** `AI_GATEWAY_API_KEY` in production if OIDC is used—see [Deployment (production)](#deployment-production)). For a **copy order** and phone/HTTPS origins (`AUTH_URL` + `NEXT_PUBLIC_APP_URL`), see [docs/vercel-env-setup.md](docs/vercel-env-setup.md).
3. Deploy, then run `pnpm db:migrate` against production **or** run migrations from CI / local with `POSTGRES_URL` pointing at production (careful).

More detail: [Deployment (production)](#deployment-production), [docs/vercel-env-setup.md](docs/vercel-env-setup.md).

## Deployment (production)

Vercel and production env: provisioning, deploy commands, **environment variable summary**, quotas, and cost posture. **Vercel dashboard checklist** (including `AUTH_URL` / `NEXT_PUBLIC_APP_URL`): [docs/vercel-env-setup.md](docs/vercel-env-setup.md).

### Prerequisites

- A [Vercel](https://vercel.com) account (Hobby tier, free)
- A [Neon](https://neon.tech) or [Supabase](https://supabase.com) account (free tier, no credit card)
- An [Upstash](https://upstash.com) account (free tier — Redis + QStash)
- A [Resend](https://resend.com) account (free tier — 100 emails/day)
- Node.js 20+ and pnpm 10+

### 1. Provision storage

### Postgres (Neon or Supabase — free tier)

**Neon** (512 MB, 190 compute-hours/mo):

1. Create a project at https://console.neon.tech
2. Copy the **connection string** (starts with `postgres://...`)
3. Set it as `POSTGRES_URL` in `.env.local` and in Vercel env vars

**Supabase** (500 MB, 2 projects):

1. Create a project at https://supabase.com/dashboard
2. Go to **Settings → Database** → copy the **transaction pooler** URI (port `6543`) for the app
3. Set it as `POSTGRES_URL` in `.env.local` and in Vercel env vars
4. For `pnpm db:migrate`, use the **direct** connection (port `5432`) if the pooler rejects DDL

### Upstash Redis (free tier — 10K commands/day)

1. Create a database at https://console.upstash.com
2. Copy the **REST URL** (or standard Redis URL)
3. Set it as `REDIS_URL`

### Vercel Blob

Provisioned automatically when you connect a Vercel project. The
`BLOB_READ_WRITE_TOKEN` is generated in the Vercel dashboard under
Storage > Blob.

### 2. Generate AUTH_SECRET

```bash
openssl rand -base64 32
```

Set the output as `AUTH_SECRET` in both `.env.local` and Vercel env vars.

### 3. AI Gateway

- **On Vercel**: AI Gateway uses OIDC tokens automatically. You do NOT
  need to set `AI_GATEWAY_API_KEY` in production — just enable AI Gateway
  in your Vercel project settings and add a credit card for the free
  credits.
- **Local dev**: Set `AI_GATEWAY_API_KEY` in `.env.local`. Get it from
  https://vercel.com/docs/ai-gateway.

### 4. Deploy to Vercel

```bash
# Install Vercel CLI
npm i -g vercel

# Link your project
vercel link

# Pull production env vars into .env.local
vercel env pull

# Deploy
vercel --prod
```

Or use the Vercel dashboard: Import > Git Repository.

### 5. Run database migrations

After deploying (or locally with `POSTGRES_URL` set):

```bash
pnpm db:migrate
```

This runs all Drizzle migrations in `lib/db/migrations/`.

### 6. Environment variable summary

| Variable              | Required locally | Required on Vercel | Notes                                    |
| --------------------- | ---------------- | ------------------ | ---------------------------------------- |
| `AUTH_SECRET`         | Yes              | Yes                | Session encryption                       |
| `POSTGRES_URL`        | Yes              | Yes                | Postgres connection string (Neon or Supabase); use pooler URI for serverless, direct for migrations |
| `REDIS_URL`           | Yes              | Yes                | Upstash Redis for rate limiting          |
| `BLOB_READ_WRITE_TOKEN` | Yes           | Yes                | Vercel Blob for file uploads             |
| `AI_GATEWAY_API_KEY`  | Yes              | **No** (OIDC)      | Only needed outside Vercel               |
| `QSTASH_TOKEN`        | Yes              | Yes                | Upstash QStash for reminders             |
| `QSTASH_CURRENT_SIGNING_KEY` | Yes       | Yes                | QStash webhook verification              |
| `QSTASH_NEXT_SIGNING_KEY` | Yes          | Yes                | QStash webhook verification (rotation)   |
| `RESEND_API_KEY`      | Yes              | Yes                | Resend for reminder and digest emails    |
| `CRON_SECRET`         | Yes              | Yes                | Protects `/api/digest` and `/api/night-review/enqueue` cron endpoints |
| `AUTH_URL`            | If not localhost | If not localhost   | Must match the **exact origin** users open (scheme + host + port). Required for NextAuth cookies on LAN or custom domain. See [Setup checklist § LAN](#access-from-another-device-on-your-lan-eg-gaming-pc-as-server) |
| `NEXT_PUBLIC_APP_URL` | If not localhost | If not localhost   | Same origin as `AUTH_URL` for client; **build-time** for Next. Off Vercel, **required** for correct absolute URLs (e.g. night-review enqueue → QStash → `POST /api/night-review/run`). |
| `VERCEL_URL`          | No               | Set by Vercel      | Used when present to derive base URL for enqueue; absent on self-hosted — then `NEXT_PUBLIC_APP_URL` applies. |
| `OLLAMA_BASE_URL`     | If using Ollama  | If using Ollama    | Default `http://127.0.0.1:11434` local; Docker/LAN: see [Setup checklist](#setup-checklist) / [beta-lan-gaming-pc.md](docs/beta-lan-gaming-pc.md). |
| `VIRGIL_OPEN_URL`     | No               | No                 | Optional; launcher / smoke open URL (packaging). |
| `WARMUP_MODEL`        | No               | No                 | Optional; `pnpm warmup:ollama` target id (defaults to `DEFAULT_CHAT_MODEL`). |
| `NIGHT_REVIEW_ENABLED` | Local/preview/self-hosted: set `1` to enable | Vercel prod: default on if unset; set `0` to disable | Scheduled night review enqueue + worker |
| `NIGHT_REVIEW_MODEL`  | No               | No                 | Default `ollama/qwen2.5:7b-review`. Only **`ollama/…`** or **`google/…`** allowed. |
| `GOOGLE_GENERATIVE_AI_API_KEY` | When using `google/…` for night review | Same | Gemini API key for scheduled night review only (not used for chat unless you pick a Gemini model there too). |
| `NIGHT_REVIEW_STAGGER_SECONDS` | No      | No                 | Delay between per-user QStash jobs (default `60`) |
| `NIGHT_REVIEW_TIMEZONE` | No             | No                 | IANA tz for idempotency window key (default `UTC`) |
| `NIGHT_REVIEW_EMAIL_ON_FINDINGS` | No   | No                 | Set to `1` to email when review finds material (needs Resend) |
| `AGENT_FETCH_ALLOWLIST_HOSTS` | No      | No                 | Comma-separated hostnames for tool `fetch` (defaults include Open-Meteo) |
| `GOOGLE_GENERATIVE_AI_API_KEY` | No | No | Direct Gemini API key (personal plan). Enables Gemini as chat fallback tier and night-review model. Get a key at https://aistudio.google.com/apikey |
| `VIRGIL_CHAT_FALLBACK` | No | No | Set to `1` to enable Ollama → Gemini → Gateway cascade on local model failure |
| `VIRGIL_FALLBACK_GEMINI_MODEL` | No | No | Gemini model for fallback (default `gemini-2.5-flash`). Bare Google model name, no prefix. |
| `VIRGIL_FALLBACK_GATEWAY_MODEL` | No | No | Gateway model for last-resort fallback (default `deepseek/deepseek-v3.2`) |
| `EMBEDDING_MODEL` | No | No | Ollama embedding model tag for `Memory` vectors (default `nomic-embed-text`); uses `OLLAMA_BASE_URL` |
| `EMBEDDING_DIMENSIONS` | No | No | Vector width; must match migration `vector(N)` (default `768`) |
| `MEM0_API_KEY` | No | No | Optional Mem0 layer; **on-Postgres** `recallMemory` tries pgvector, then FTS, then Mem0 when configured |
| `MEM0_MONTHLY_SEARCH_LIMIT` | No | No | Monthly cap on mem0 search API calls; falls back to Postgres FTS when exhausted (default `1000`) |
| `MEM0_MONTHLY_ADD_LIMIT` | No | No | Optional monthly cap on mem0 **add** (write) calls when `REDIS_URL` is set; when exhausted, mem0 writes are skipped (omit env for unlimited) |
| `MEM0_DISABLE_LOCAL_SYNC` | No | No | Set to `1` to skip post-turn Mem0 batch ingest for **local Ollama** chats only (cloud path unchanged) |
| `MEMORY_PROMPT_WINDOW_DAYS` | No | No | Days of `Memory` history considered for the chat system prompt (default `30`; max `365`) |
| `MEMORY_PROMPT_FETCH_LIMIT` | No | No | Max `Memory` rows loaded into the prompt pipeline per request (default `80`; max `200`) |
| `VIRGIL_CALENDAR_INTEGRATION` | No | No | Set to `1` for read-only **Google Calendar** (`primary`). Requires `GOOGLE_CALENDAR_*` below. Routes: `GET /api/calendar/status`, `GET /api/calendar/events?timeMin=&timeMax=` (session auth). |
| `GOOGLE_CALENDAR_CLIENT_ID` | With calendar | Same | OAuth client ID (Google Cloud Console). |
| `GOOGLE_CALENDAR_CLIENT_SECRET` | With calendar | Same | OAuth client secret. |
| `GOOGLE_CALENDAR_REFRESH_TOKEN` | With calendar | Same | Long-lived refresh token with scope `https://www.googleapis.com/auth/calendar.readonly` (obtain via OAuth consent / device flow; store like any secret). |
| `VIRGIL_HEALTH_INGEST_ENABLED` | No | No | Set to `1` to allow `POST /api/health/ingest` (Bearer `VIRGIL_HEALTH_INGEST_SECRET`). For Apple Watch: native iOS/watchOS app reads HealthKit and POSTs batches. |
| `VIRGIL_HEALTH_INGEST_SECRET` | When ingest on | Same | Shared secret; treat like `CRON_SECRET` (high privilege — rotates snapshots for `VIRGIL_HEALTH_INGEST_USER_ID`). |
| `VIRGIL_HEALTH_INGEST_USER_ID` | When ingest on | Same | Postgres `User.id` UUID that receives all ingested rows (single-owner pattern). |
| `VIRGIL_GIT_SIGNALS` | No | No | Reserved: set to `1` when Git/Vercel commit signals for study momentum are implemented |
| `VIRGIL_JOURNAL_FILE_PARSE` | No | No | Reserved: set to `1` when optional journaling file parse is implemented |
| `GITHUB_REPOSITORY` | No | No | `owner/repo` — enables `submitProductOpportunity` (gateway models); see [docs/github-product-opportunity.md](docs/github-product-opportunity.md) |
| `GITHUB_PRODUCT_OPPORTUNITY_TOKEN` or `GITHUB_TOKEN` | No | No | PAT with `issues: write` on that repo |
| `GITHUB_PRODUCT_OPPORTUNITY_LABELS` | No | No | Optional comma-separated issue labels |
| `AGENT_TASK_TRIAGE_ENABLED` | No | No | Set to `1` to enable background triage of submitted agent tasks via local Ollama |
| `AGENT_TASK_TRIAGE_MODEL` | No | No | Model id for triage worker (default `ollama/qwen2.5:7b-instruct`) |
| `OPENCLAW_URL` | No | No | Optional LAN OpenClaw gateway (e.g. `ws://host:3100`); enables `delegateTask` when set with HTTP reachability; see [docs/openclaw-bridge.md](docs/openclaw-bridge.md) |
| `OPENCLAW_HTTP_URL` | No | No | Explicit HTTP origin for OpenClaw REST (defaults from `OPENCLAW_URL`) |
| `OPENCLAW_EXECUTE_PATH` | No | No | POST path for intents (default `/api/execute`) |
| `OPENCLAW_SKILLS_PATH` | No | No | GET path for skills (default `/api/skills`) |
| `OPENCLAW_HEALTH_PATH` | No | No | GET path for health ping (default `/health`) |
| `VIRGIL_MULTI_AGENT_ENABLED` | No | No | Set to `1` / `true` for gateway-only planner+executor pass before `streamText` (extra cost/latency) |
| `VIRGIL_MULTI_AGENT_PLANNER_MODEL` | No | No | Optional model id for the planner when different from the chat model |
| `BOTID_ENFORCE` | No | No | Set to `1` / `true` to return 403 on `POST /api/chat` when BotID classifies an unverified bot; default is log-only in production (`lib/security/botid-chat.ts`) |

### Hobby-to-Pro threshold

Monitor these free-tier limits:

- **Vercel Hobby**: 100 GB bandwidth/mo, 1,000 serverless fn-hours/mo
- **Neon free**: 512 MB storage, 190 compute-hours/mo, 1 project; **Supabase free**: 500 MB, 2 projects
- **Upstash Redis free**: 10K commands/day, 256 MB storage
- **Upstash QStash free**: 500 messages/day
- **Resend free**: 100 emails/day, 3,000/month
- **Vercel Cron (Hobby)**: 2 cron jobs (digest + night-review enqueue — at the Hobby limit)
- **Vercel Blob**: 1 GB on Hobby

At ~3 active deployments with moderate traffic, expect to need
**Vercel Pro ($20/mo)** and possibly **Neon Launch ($15/mo)**. Factor
infrastructure cost per seat before LLM costs.

### Self-hosted schedules (no Vercel Cron)

Same flows as [Scheduled jobs on the host (no Vercel Cron)](#scheduled-jobs-on-the-host-no-vercel-cron) above. Cross-link anchor for docs that pointed at `DEPLOY.md`.

### Minimal “live v1” posture (cost-first)

- **Single Vercel Hobby project** + **Neon or Supabase** + **Upstash** + **Resend** (all free tiers) is enough for **Virgil** in personal use or a tiny closed beta if traffic stays low and **AI Gateway** usage is capped (use **local Ollama** for bulk chat; gateway for occasional hosted models).
- **Do not** add databases, queues, or SaaS until a free-tier limit is actually hit — see the table in §6 above.
- Roadmap and phased goals: [docs/PROJECT.md](docs/PROJECT.md), [docs/ENHANCEMENTS.md](docs/ENHANCEMENTS.md).

## Testing Guidance

Always verify behavior that could silently hurt the local path.

After a pull that changes `package.json` or the lockfile, run **`pnpm install`** so new packages (for example `@ai-sdk/google`) are present in `node_modules` before **`pnpm check`**, **`pnpm run type-check`**, or **`pnpm test:unit`** — otherwise TypeScript may fail with “Cannot find module” for newly added dependencies.

High-value checks:

- `pnpm stable:check` — `pnpm check` + `pnpm run type-check` + `pnpm test:unit` (fast stability gate)
- `pnpm stable:check:full` — same plus `pnpm build` (needs DB for migrations)
- `pnpm test:unit` (all `tests/unit/*.test.ts`; CI runs this after `pnpm check`)
- `node --test --import tsx tests/unit/local-context.test.ts` — quick slice when iterating on local context only
- `pnpm check`
- `pnpm build`
- `pnpm ollama:smoke`

When changing local-model behavior, favor focused regression tests around:

- prompt selection
- model defaults
- Ollama routing
- trimmed-context behavior
- local error messages

## Agent Task Pickup Convention

Virgil can accept self-improvement tasks via chat (`submitAgentTask` tool, gateway-only). Tasks are stored in the `AgentTask` Postgres table and optionally mirrored as GitHub Issues with `agent-task` + type labels. The owner can manage tasks in-app at **`/agent-tasks`** (list, filter, approve/reject/done).

### For Cursor agents (or other automated agents)

1. **On session start:** query the `AgentTask` table or GitHub Issues with label `approved-for-build` for approved tasks.
2. **Pick** the highest-priority approved task.
3. **Follow** existing coding guidance in this file (TypeScript strict, focused changes, local-first principles).
4. **Update status** to `in_progress` via `PATCH /api/agent-tasks` before starting work, then `done` on completion (or note blockers).
5. **Reference** the task ID in commit messages when implementing a task.

### Background triage

When `AGENT_TASK_TRIAGE_ENABLED=1`, a cron job (`GET /api/agent-tasks/enqueue`, same auth as night review) fans out via QStash to a triage worker that uses local Ollama (`generateObject`) to analyze submitted tasks against project principles. The worker writes `agentNotes` (alignment analysis, scope estimate, suggested files, risks) but does **not** auto-approve — the owner must approve via the API.

**Scheduling:** Vercel Hobby is at the 2-cron limit (digest + night-review). Use self-hosted cron for the triage enqueue (e.g. `0 */6 * * *` every 6 hours, or piggyback on the `0 3 * * *` slot via a script that curls both endpoints). See [Scheduled jobs on the host](#scheduled-jobs-on-the-host-no-vercel-cron).

### API

- `GET /api/agent-tasks?status=approved` — list tasks (auth required)
- `PATCH /api/agent-tasks` — update status/notes (auth required, body: `{ id, status, agentNotes? }`)

## Key Decisions

Summaries only; traceable ADRs with context and dates: **[docs/DECISIONS.md](docs/DECISIONS.md)**.

- **v1 vs v2 deployment tracks (2026-04-03 ADR):** v1 hosted stack (Vercel + Neon or Supabase + Upstash Redis/QStash + Resend + Blob) vs planned v2 Mac mini + Ollama + Python backend; v2 data **either** Postgres-on-home (migration parity) **or** SQLite/Mem0 greenfield — [docs/PROJECT.md](docs/PROJECT.md), [docs/V2_MIGRATION.md](docs/V2_MIGRATION.md), [docs/V1_V2_RISK_AUDIT.md](docs/V1_V2_RISK_AUDIT.md).
- **v2 behavioral specs (2026-04-04 ADR):** goals/habits, project graph, weekly schedule, and briefing payload are specified for the future Python backend in [docs/V2_BEHAVIORAL_SPECS.md](docs/V2_BEHAVIORAL_SPECS.md); HTTP route sketches in [docs/V2_BEHAVIORAL_API.md](docs/V2_BEHAVIORAL_API.md). Distinct from v1 pivot `Goal` / `GoalWeeklySnapshot` design — see [docs/V2_MIGRATION.md](docs/V2_MIGRATION.md) § Behavioral and goal state.
- **Bespoke single-owner** product intent: [docs/OWNER_PRODUCT_VISION.md](docs/OWNER_PRODUCT_VISION.md) (2026-03-31 ADR). Commercial multi-tenant SaaS is not a design goal for this repo. Personal-assistant-only surface (business/front-desk paths removed 2026-04). Local models default; gateway optional. Optional gateway multi-agent orchestration via env (see `lib/ai/orchestration/`).
- **Target architecture (owner intent):** Virgil as **brain** (this repo); **Agent Zero** as preferred external **executor** on a home **Mac mini (~48 GB unified memory)**; bridge **not shipped** — see [docs/TARGET_ARCHITECTURE.md](docs/TARGET_ARCHITECTURE.md) and [docs/DECISIONS.md](docs/DECISIONS.md).
- Postgres FTS for recall (no casual vector DB). QStash for reminders. Docker Compose defaults include **bundled Ollama** + health-gated **`virgil-app`** (see `docker-compose.yml`); host-Ollama layout in `docker-compose.host-ollama.yml`.
- Night review optional ([workspace/night/README.md](workspace/night/README.md)). HTTP auth cookies via `shouldUseSecureAuthCookie()` where applicable.
- Voice: clarity over flattery; slim prompts stay minimal. Local **slim/compact** copy branches on `LocalModelClass` (`3b` vs `7b`, tag-inferred when unset) — see [docs/DECISIONS.md](docs/DECISIONS.md).
- **Local context trim** (`lib/ai/trim-context.ts`): per-message overhead in budget estimates; long **user or assistant** turns capped before split/keep; middle shrink prefers dropping removable assistant before removable user and preserves AI SDK tool structural parts until last resort — see [docs/DECISIONS.md](docs/DECISIONS.md).
- **Product opportunity** (`submitProductOpportunity`): gateway-only; GitHub errors sanitized for tool results — [docs/github-product-opportunity.md](docs/github-product-opportunity.md), [docs/DECISIONS.md](docs/DECISIONS.md).
- **Night insights** (`/night-insights`): grouped by night-review run; accept/dismiss updates memory metadata only — [workspace/night/README.md](workspace/night/README.md), [lib/night-review/digest-display.ts](lib/night-review/digest-display.ts).
- **Self-hosted / LAN:** cron parity with [`vercel.json`](vercel.json) and `AUTH_URL` / `NEXT_PUBLIC_APP_URL` — [Scheduled jobs on the host](#scheduled-jobs-on-the-host-no-vercel-cron), [Self-hosted schedules](#self-hosted-schedules-no-vercel-cron) (alias anchor).
- **Agent task orchestration** (`submitAgentTask`): gateway-only tool writes to `AgentTask` table + optional GitHub Issue; background triage via local Ollama `generateObject`; manual approval required before any agent picks up work; owner UI at `/agent-tasks` — see [Agent Task Pickup Convention](#agent-task-pickup-convention).
- **Proactive pivot (E11):** phased work toward nudges/goals/intent routing — [docs/tickets/2026-04-02-proactive-pivot-epic.md](docs/tickets/2026-04-02-proactive-pivot-epic.md); semantic recall strategy [docs/DECISIONS.md](docs/DECISIONS.md) (2026-04-02). Does not change default chat until phase PRs merge.
- **OpenClaw bridge** (optional): `delegateTask` / `approveOpenClawIntent`, `PendingIntent` queue, `GET/PATCH /api/openclaw/pending` — [docs/openclaw-bridge.md](docs/openclaw-bridge.md), [docs/DECISIONS.md](docs/DECISIONS.md).
- **Chat fallback cascade** (`VIRGIL_CHAT_FALLBACK=1`): when a local Ollama model fails (unreachable, missing model, timeout), the chat route automatically escalates to direct Gemini (personal API key), then Vercel AI Gateway. No mid-stream fallback; escalation uses gateway-style prompt and full tool set. See [docs/DECISIONS.md](docs/DECISIONS.md) (2026-04-04).

## Enhancement Review Process

Backlog (E1–E11, …), review cadence, and acceptance criteria: [docs/ENHANCEMENTS.md](docs/ENHANCEMENTS.md).

## Review Checklist

- [ ] `pnpm check` passes
- [ ] `pnpm build` passes
- [ ] Focused tests cover the changed local-model behavior
- [ ] No hardcoded secrets were introduced
- [ ] New env vars are documented everywhere required
- [ ] Optional multi-agent / gateway-only features do not hurt the default local path
- [ ] Prompt changes do not increase sycophancy or context bloat
- [ ] Docker/local instructions still match real runtime behavior

## Handoff Checklist

Before ending a session, answer these:

1. Did this improve the default personal-assistant experience?
2. Did it help local 3B/7B models specifically?
3. Did it increase recurring cost?
4. Did it add unnecessary prompt or tool complexity?
5. Did it preserve Virgil's honest, non-sycophantic voice?

If any answer is unfavorable, call it out explicitly instead of hand-waving it away.

## v2 Plan

A v2 architecture is planned for June 2026. Primary hardware (Mac Mini M4 Pro) is resolved.
The v2 plan is documented in [`docs/V2_ARCHITECTURE.md`](docs/V2_ARCHITECTURE.md).
Migration path is in [`docs/V2_MIGRATION.md`](docs/V2_MIGRATION.md).
Hardware decisions are in [`docs/HARDWARE.md`](docs/HARDWARE.md).

**v2 is not in development.** Do not build v2 features in this repo. The current
focus is running v1 reliably and collecting evaluation data in `workspace/v2-eval/`.

### Planned v2 Python backend (June 2026)

Virgil's v2 backend is a headless Python service running on a **Mac Mini M4 Pro** (48GB unified memory, 2TB SSD). The Next.js frontend (this repo, deployed on Vercel) talks to the backend over Tailscale or Cloudflare Tunnel.

**Inference model:** Local-first hybrid. Local Ollama handles 80-90% of inference at $0 cost. Gemini API is a paid escalation path for complex reasoning only.

- **Local fast (14B):** Event classification, memory ops, nudge phrasing, tool selection, briefings, simple Q&A, night mode.
- **Local heavy (32B):** Draft review, multi-factor classification, research summarization.
- **Cloud heavy (Gemini 2.5 Pro):** Multi-step planning, novel problem solving, frontier reasoning. Budget-tracked (~$30/month soft cap).
- **Night mode:** Runs entirely on local models. No API cost. Proactivity is free.

**Key v2 rule:** Every Gemini call costs money. Local inference is free. Default to local. Escalate to Gemini only for tasks that demonstrably require frontier reasoning.

Key v2 changes: Python backend, tool execution, night mode, skills system, split
frontend/backend, local Apple Silicon inference. See the architecture doc for details.

Optional: set `V2_EVAL_LOGGING=true` to append chat interaction summaries to
`workspace/v2-eval/interactions.jsonl` (gitignored). See `lib/v2-eval/interaction-log.ts`.

**v1 groundwork for migration:** ticketed two-sprint bridge (docs, opt-in telemetry)—
[docs/tickets/2026-04-01-v2-groundwork-overview.md](docs/tickets/2026-04-01-v2-groundwork-overview.md). ADR: [docs/DECISIONS.md](docs/DECISIONS.md) (2026-04-01).
