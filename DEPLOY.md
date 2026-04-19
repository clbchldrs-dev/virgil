# Deployment — link hub

Authoritative detail (env table, Vercel, quotas, self-hosted cron) lives in **[AGENTS.md](AGENTS.md)**. This file is a **thin index** aligned with the SSOT map in [docs/PROJECT.md](docs/PROJECT.md).

**v1 vs v2 framing (no env duplication):** [docs/PROJECT.md](docs/PROJECT.md) (Deployment tracks), [docs/V1_V2_RISK_AUDIT.md](docs/V1_V2_RISK_AUDIT.md) (what v1 complicates for v2).

- **[docs/vercel-env-setup.md](docs/vercel-env-setup.md)** — **Vercel env copy order**, `AUTH_URL` / `NEXT_PUBLIC_APP_URL`, first deploy checklist
- **[docs/virgil-manos-delegation.md](docs/virgil-manos-delegation.md)** — **Vercel → `virgil-manos`**: Cloudflare Tunnel to Hermes (`HERMES_*`); OpenClaw stays local behind Hermes
- **[AGENTS.md — Deployment (production)](AGENTS.md#deployment-production)** — provision, deploy, **environment variable summary**, Hobby limits, cost posture
- **[AGENTS.md — Git integration](AGENTS.md#git-integration-automatic-deploys)** — **GitHub ↔ Vercel enabled**: pushes to **`main`** deploy Production; migrations still manual (`pnpm db:migrate`)
- **[docs/free-tier-feature-map.md](docs/free-tier-feature-map.md)** — which **features** hit **Vercel / QStash / Resend / Gateway** quotas
- **[AGENTS.md — Scheduled jobs / self-hosted schedules](AGENTS.md#scheduled-jobs-on-the-host-no-vercel-cron)** — cron parity with [`vercel.json`](vercel.json)
- **[docs/PROJECT.md](docs/PROJECT.md)** — project map and handoff
- **[SETUP.md](SETUP.md)** — setup link hub
- **[docs/memory-store-parity.md](docs/memory-store-parity.md)** — **one Postgres** for local + Vercel; optional **`POST /api/memory/bridge`** for terminal/scripts
- **[docs/google-calendar-integration.md](docs/google-calendar-integration.md)** — optional Google Calendar env + chat/REST behavior (production: set the same `GOOGLE_CALENDAR_*` and `VIRGIL_CALENDAR_INTEGRATION` on the host)
- **[docs/security/tool-inventory.md](docs/security/tool-inventory.md)** — cron / QStash auth matrix
