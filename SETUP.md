# Setup — condensed guide

Authoritative procedures and the **full env var catalog** live in **[AGENTS.md](AGENTS.md)** (Setup checklist + Deployment). This page is the **short path**: what to configure, in what order, and which doc has the details.

**Documentation map:** [docs/PROJECT.md](docs/PROJECT.md) · **Index:** [DOCUMENTATION_INDEX.md](DOCUMENTATION_INDEX.md)

---

## 1. Local development (minimum)

1. Env scaffold: `pnpm virgil:env:init` copies [`.env.example`](.env.example) → `.env.local` (or appends missing keys if you already have one, as commented lines).
2. Set core services (order matches [AGENTS.md — Step 1](AGENTS.md#step-1--fill-credentials-in-envlocal)):
   - `AUTH_SECRET` — `openssl rand -base64 32`
   - `POSTGRES_URL` — Neon or Supabase
   - `REDIS_URL` — Upstash (`rediss://…`)
   - `BLOB_READ_WRITE_TOKEN` — Vercel Blob
   - `AI_GATEWAY_API_KEY` — for hosted models on your machine
   - `QSTASH_TOKEN`, `QSTASH_CURRENT_SIGNING_KEY`, `QSTASH_NEXT_SIGNING_KEY` (+ `QSTASH_URL` if US region — see AGENTS)
   - `RESEND_API_KEY`
   - `CRON_SECRET` — protects cron routes locally if you hit them
3. `pnpm install` → `pnpm db:migrate` → `pnpm virgil:start` ([README.md](README.md)). The Next.js server, optional OpenClaw SSH tunnel, and optional delegation poll worker all run in the same terminal.
4. Optional: `OLLAMA_BASE_URL` if Ollama is not on localhost; pull model tags you use ([README.md](README.md) — Models).

**Preflight:** `pnpm virgil:status` (or `--strict` for CI). One command shows every feature block with fix hints; also exposed at `GET /api/virgil/status` in dev. See [AGENTS.md — Graceful local start](AGENTS.md#graceful-local-start-before-envlocal-is-complete). **In the app:** user menu → **This deployment** (`/deployment`) shows what this running instance supports (cloud vs local models, tools) without raw env diagnostics.

---

## 2. Vercel production (minimum)

Use **[docs/vercel-env-setup.md](docs/vercel-env-setup.md)** for:

- `pnpm env:vercel:pull` — sync dashboard → `.env.local`
- Required Production vars table (auth, Postgres, Redis, Blob, QStash, Resend, `CRON_SECRET`, `AUTH_URL`, `NEXT_PUBLIC_APP_URL`)
- Post-deploy: `POSTGRES_URL='…' pnpm db:migrate`, cron + `CRON_SECRET`

Full production table and AI Gateway / Ollama notes: [AGENTS.md — Deployment (production)](AGENTS.md#deployment-production).

---

## 3. Optional features (enable when needed)

| Feature | Where to configure |
|--------|---------------------|
| Night review | [AGENTS.md — §1.9 Night review](AGENTS.md#19-night-review-optional), [workspace/night/README.md](workspace/night/README.md) |
| Google Calendar | [docs/google-calendar-integration.md](docs/google-calendar-integration.md) |
| Hermes / OpenClaw delegation | [docs/openclaw-bridge.md](docs/openclaw-bridge.md), [AGENTS.md](AGENTS.md) |
| LLM Wiki | [AGENTS.md](AGENTS.md) (`VIRGIL_WIKI_*`) |
| Mem0 | [AGENTS.md](AGENTS.md) (`MEM0_*`) |
| Same Postgres from CLI / multiple machines | [docs/memory-store-parity.md](docs/memory-store-parity.md) |
| Digital Self (sibling package) | [docs/digital-self-bridge.md](docs/digital-self-bridge.md) |

Quotas and background jobs: [docs/free-tier-feature-map.md](docs/free-tier-feature-map.md).

---

## 4. Link hub (discoverability)

- **[README.md](README.md)** — human-facing overview and troubleshooting matrix (Ollama reachability).
- **[DEPLOY.md](DEPLOY.md)** — thin hub → [AGENTS.md — Deployment](AGENTS.md#deployment-production).
- **[docs/beta-lan-gaming-pc.md](docs/beta-lan-gaming-pc.md)** — LAN / Ubuntu home server.
- **[packaging/README.md](packaging/README.md)** — desktop launcher.
