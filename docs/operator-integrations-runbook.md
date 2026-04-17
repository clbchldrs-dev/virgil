# Operator runbook: integrations and env by host

Single-owner checklist to verify **calendar, GitHub, email, Slack, and cron** paths. Keep secrets out of git; mirror this table in your private notes with real hostnames filled in.

## Where env vars live

| Surface | Typical host | Notes |
|---------|--------------|--------|
| **Vercel production** | Vercel project env | No `OLLAMA_BASE_URL` to LAN Ollama from serverless; use gateway models or self-host app on LAN. |
| **LAN / Docker app** | `.env.docker` or server env | Set `OLLAMA_BASE_URL` to Manos or bundled `ollama` service. `AUTH_URL` / `NEXT_PUBLIC_APP_URL` = browser origin. |
| **virgil-manos (Ubuntu)** | Ollama + optional OpenClaw | Holds inference and delegation; **not** where Next.js env usually lives unless you self-host the app there. |
| **Developer laptop** | `.env.local` | Local `pnpm dev`; can point `OLLAMA_BASE_URL` at Manos LAN IP. |

Full variable names: [`.env.example`](../.env.example) and [AGENTS.md](../AGENTS.md).

---

## Phase A — verification (happy path)

### 1. Google Calendar (read-only)

1. Set `VIRGIL_CALENDAR_INTEGRATION=1`, `GOOGLE_CALENDAR_CLIENT_ID`, `GOOGLE_CALENDAR_CLIENT_SECRET`, `GOOGLE_CALENDAR_REFRESH_TOKEN` (see [google-calendar-integration.md](google-calendar-integration.md)).
2. Sign in (non-guest). `GET /api/calendar/status` → enabled + configured.
3. `GET /api/calendar/events?timeMin=…&timeMax=…` → JSON events.
4. **Chat:** use a **tool-capable hosted/gateway** model; local Ollama does not register `listCalendarEvents` on the default path.

### 2. GitHub (issues from chat)

1. Set `GITHUB_REPOSITORY`, `GITHUB_PRODUCT_OPPORTUNITY_TOKEN` or `GITHUB_TOKEN`, and agent-task vars if you use `submitAgentTask` (see [github-product-opportunity.md](github-product-opportunity.md)).
2. From chat with a gateway model, run `submitProductOpportunity` / `submitAgentTask` against a **test repo** first.
3. Confirm Issues appear; errors in chat should stay sanitized.

### 3. Email outbound (Resend)

1. `RESEND_API_KEY` set on every host that sends mail.
2. Trigger: `setReminder` → QStash → [`/api/reminders`](../app/api/reminders/route.ts), or wait for cron `GET /api/digest`.
3. Production: verify a **sending domain** in Resend and replace default `from:` addresses in code when ready (currently `onboarding@resend.dev` in several routes).

### 4. Email inbound → Memory

1. `VIRGIL_EMAIL_INGEST_ENABLED=1`, `RESEND_WEBHOOK_SECRET`, `RESEND_API_KEY`, `VIRGIL_EMAIL_INGEST_ALLOWED_FROM`, `VIRGIL_INGEST_USER_ID`.
2. Configure Resend **Webhook** → `POST /api/ingest/email` (see AGENTS.md).
3. Send from an allowlisted address; confirm a new `Memory` row.

### 5. Slack (scheduled check-in)

**Native path (this repo):** When `VIRGIL_SLACK_CHECKIN_WEBHOOK_URL` *or* (`SLACK_BOT_TOKEN` + `VIRGIL_SLACK_CHECKIN_CHANNEL_ID`) is set, each successful **daily digest** email pass also posts the same text to Slack (failures are logged; email still attempts first).

**Interactive / delegated sends:** [OpenClaw bridge](openclaw-bridge.md) (`send-slack` skill on the gateway) and [Digital Self](digital-self-bridge.md) (policy + Slack events) are **separate** stacks—use them when the model or orchestrator should draft/send messages, not for the 08:00 UTC digest mirror.

### 6. Cron

- `CRON_SECRET` + `Authorization: Bearer …` on `GET /api/digest` and `GET /api/night-review/enqueue` (see AGENTS.md § Scheduled jobs).

---

## Check-in rhythm (product semantics)

| Cadence | Mechanism | Purpose |
|---------|-----------|---------|
| **Daily (morning)** | `GET /api/digest` (08:00 UTC on Vercel) | Email + optional **Slack** mirror of last-24h memories / proposals. |
| **Nightly** | `GET /api/night-review/enqueue` → worker | Deeper rollup; optional email on findings; `Memory` with `metadata.source = night-review`. |
| **Weekly** | Chat + [`/api/goal-guidance/weekly`](../app/(chat)/api/goal-guidance/weekly/route.ts) (GET/POST, session auth) | Structured metrics / snapshots; prompt templates in `lib/ai/goal-guidance-prompt.ts`. |

Digest and night review **complement** each other; neither replaces the other without an explicit product change.

---

## Related docs

- [integration-test-matrix.md](integration-test-matrix.md) — regression-style matrix.
- [manos-performance.md](manos-performance.md) — LAN inference tuning for **virgil-manos**.
