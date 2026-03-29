# Deployment Guide — Front Desk Chatbot

## Prerequisites

- A [Vercel](https://vercel.com) account (Hobby tier, free)
- A [Neon](https://neon.tech) account (free tier, no credit card)
- An [Upstash](https://upstash.com) account (free tier)
- Node.js 20+ and pnpm 10+

## 1. Provision storage

### Neon Postgres (free tier — 512 MB, 190 compute-hours/mo)

1. Create a project at https://console.neon.tech
2. Copy the **connection string** (starts with `postgres://...`)
3. Set it as `POSTGRES_URL` in `.env.local` and in Vercel env vars

### Upstash Redis (free tier — 10K commands/day)

1. Create a database at https://console.upstash.com
2. Copy the **REST URL** (or standard Redis URL)
3. Set it as `REDIS_URL`

### Vercel Blob

Provisioned automatically when you connect a Vercel project. The
`BLOB_READ_WRITE_TOKEN` is generated in the Vercel dashboard under
Storage > Blob.

## 2. Generate AUTH_SECRET

```bash
openssl rand -base64 32
```

Set the output as `AUTH_SECRET` in both `.env.local` and Vercel env vars.

## 3. AI Gateway

- **On Vercel**: AI Gateway uses OIDC tokens automatically. You do NOT
  need to set `AI_GATEWAY_API_KEY` in production — just enable AI Gateway
  in your Vercel project settings and add a credit card for the free
  credits.
- **Local dev**: Set `AI_GATEWAY_API_KEY` in `.env.local`. Get it from
  https://vercel.com/docs/ai-gateway.

## 4. Deploy to Vercel

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

## 5. Run database migrations

After deploying (or locally with `POSTGRES_URL` set):

```bash
pnpm db:migrate
```

This runs all Drizzle migrations in `lib/db/migrations/`.

## 6. Environment variable summary

| Variable              | Required locally | Required on Vercel | Notes                                    |
| --------------------- | ---------------- | ------------------ | ---------------------------------------- |
| `AUTH_SECRET`         | Yes              | Yes                | Session encryption                       |
| `POSTGRES_URL`        | Yes              | Yes                | Neon connection string                   |
| `REDIS_URL`           | Yes              | Yes                | Upstash Redis for rate limiting          |
| `BLOB_READ_WRITE_TOKEN` | Yes           | Yes                | Vercel Blob for file uploads             |
| `AI_GATEWAY_API_KEY`  | Yes              | **No** (OIDC)      | Only needed outside Vercel               |

## Hobby-to-Pro threshold

Monitor these free-tier limits:

- **Vercel Hobby**: 100 GB bandwidth/mo, 1,000 serverless fn-hours/mo
- **Neon free**: 512 MB storage, 190 compute-hours/mo, 1 project
- **Upstash free**: 10K commands/day, 256 MB storage
- **Vercel Blob**: 1 GB on Hobby

At ~3 active business clients with moderate traffic, expect to need
**Vercel Pro ($20/mo)** and possibly **Neon Launch ($15/mo)**. Factor
~$7/client/mo infrastructure into pricing before LLM costs.
