# Vercel production environment variables

Use this when deploying Virgil to **Vercel** so auth, the client, cron, and background jobs work (including **phone access** over HTTPS).

Authoritative reference: [AGENTS.md](../AGENTS.md) (full table and provider links). This page is a **copy order** and Vercel-specific notes.

## Before you paste

1. Create accounts and grab credentials:
   - **Neon** or **Supabase** — `POSTGRES_URL` (pooled/serverless string; Supabase: transaction pooler URI, port `6543`)
   - **Upstash** — `REDIS_URL` (TLS `rediss://…`) and **QStash** — `QSTASH_TOKEN`, `QSTASH_CURRENT_SIGNING_KEY`, `QSTASH_NEXT_SIGNING_KEY`, and **`QSTASH_URL`** when your QStash region is **US** (`https://qstash-us-east-1.upstash.io`; SDK defaults to EU if unset)
   - **Resend** — `RESEND_API_KEY`
   - **Vercel project** — connect the Git repo, add **Blob** → `BLOB_READ_WRITE_TOKEN`
2. In Vercel → Project → **Settings → Environment Variables**, add variables for **Production** (and Preview/Development only if you use them).

## Required for a working production app

Set these first (all **Production** unless you use Preview DBs separately):

| Variable | Notes |
| -------- | ----- |
| `AUTH_SECRET` | `openssl rand -base64 32` — no quotes in dashboard unless needed |
| `POSTGRES_URL` | Postgres connection string (Neon or Supabase pooler URI) |
| `REDIS_URL` | Upstash Redis (`rediss://`) |
| `BLOB_READ_WRITE_TOKEN` | From Vercel Storage → Blob for this project |
| `QSTASH_TOKEN` | JWT-shaped (`ey…`) |
| `QSTASH_URL` | Optional for EU; **set for US** QStash: `https://qstash-us-east-1.upstash.io` (see [AGENTS.md](../AGENTS.md) step 1.6) |
| `QSTASH_CURRENT_SIGNING_KEY` | From QStash dashboard |
| `QSTASH_NEXT_SIGNING_KEY` | Rotation key from QStash |
| `RESEND_API_KEY` | Starts with `re_` |
| `CRON_SECRET` | `openssl rand -base64 32` — must match what Vercel Cron sends (Bearer) |
| `AUTH_URL` | Exact origin users open, e.g. `https://your-app.vercel.app` |
| `NEXT_PUBLIC_APP_URL` | **Same value as `AUTH_URL`** for production |

After adding or changing **`NEXT_PUBLIC_APP_URL`**, trigger a **new deployment** so the client bundle picks it up.

## AI and models on Vercel

- **`AI_GATEWAY_API_KEY`** — Usually **omit on Vercel** if AI Gateway uses OIDC for this project ([AGENTS.md](../AGENTS.md)). Keep it in `.env.local` for local dev.
- **`OLLAMA_BASE_URL`** — The chat route calls Ollama from the **Vercel runtime**. A URL like `http://192.168.1.10:11434` is **not** reachable from Vercel’s network. To use Ollama with a Vercel-deployed app you need either an **HTTPS** endpoint (reverse proxy + auth—not raw Ollama on `0.0.0.0`) or **self-host** the Next app on your LAN instead. For the matrix, see [README.md](../README.md) (Troubleshooting local models). Optional: **`VIRGIL_GATEWAY_FALLBACK_OLLAMA`** + **`GOOGLE_GENERATIVE_AI_API_KEY`** help when the gateway is rate-limited or down (see [AGENTS.md](../AGENTS.md) env table).

## Optional features

Copy from [.env.example](../.env.example) only if you use the feature:

- **Night review** — `NIGHT_REVIEW_ENABLED`, `NIGHT_REVIEW_MODEL` (**`google/…` + `GOOGLE_GENERATIVE_AI_API_KEY`** on Vercel, or `ollama/…` if Ollama is reachable from the runtime), `NIGHT_REVIEW_TIMEZONE`, `NIGHT_REVIEW_EMAIL_ON_FINDINGS`, `AGENT_FETCH_ALLOWLIST_HOSTS`
- **GitHub product opportunities** — `GITHUB_REPOSITORY`, `GITHUB_PRODUCT_OPPORTUNITY_TOKEN` (or `GITHUB_TOKEN`)
- **Mem0** — `MEM0_API_KEY`, `MEM0_MONTHLY_SEARCH_LIMIT` (default `1000`; caps retrieval API calls per month, falls back to Postgres FTS)
- **Jira tools** — `JIRA_BASE_URL`, `JIRA_EMAIL`, `JIRA_API_TOKEN`
- **Bot abuse enforcement** — `BOTID_ENFORCE=1` to return 403 for unverified bot traffic on `POST /api/chat` (recommended for public internet exposure)
- **Rate limit** — `SKIP_CHAT_MESSAGE_RATE_LIMIT` (usually leave unset in production)

## After first deploy

1. Run migrations against production (from a trusted machine):

   ```bash
   POSTGRES_URL='postgresql://…' pnpm db:migrate
   ```

2. Open your **`AUTH_URL`** on a phone, sign in, and confirm chat persists.
3. Vercel Cron ([`vercel.json`](../vercel.json)) calls `/api/digest` and `/api/night-review/enqueue` with `Authorization: Bearer $CRON_SECRET` — ensure **`CRON_SECRET`** is set on Vercel.

## Troubleshooting

| Symptom | Check |
| ------- | ----- |
| Login loops or no session on phone | `AUTH_URL` and `NEXT_PUBLIC_APP_URL` match the URL in the address bar exactly (including `https`). |
| Night review / digest never runs | `CRON_SECRET` set; Vercel Cron enabled on Hobby (job count limits). |
| “Activate gateway” / model errors | AI Gateway enabled for the team; card on file if Vercel requires it. |
