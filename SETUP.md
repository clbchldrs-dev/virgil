# Setup checklist

Project root: `front-desk-chatbot`. Fill [`.env.local`](.env.local) first, then run migrations and the dev server.

---

## Step 1 — Fill credentials in `.env.local`

Do these in order. Paste each value on **one line** with no spaces around `=`.

### 1.1 `AUTH_SECRET`

1. Open Terminal.
2. Run: `openssl rand -base64 32`
3. Copy the entire output (one line).
4. Paste after `AUTH_SECRET=` in `.env.local` (no quotes unless the secret contains special characters that break the file—usually no quotes needed).

### 1.2 `POSTGRES_URL` (Neon)

1. Go to [Neon Console](https://console.neon.tech) and sign up / log in.
2. **Create project** (pick a region close to you).
3. Open the project → find **Connection string** (or **Connect**).
4. Copy the URI that starts with `postgres://` or `postgresql://`.
5. If Neon shows a **pooled** connection for serverless, prefer that for Vercel/Next.js.
6. Paste into `.env.local` after `POSTGRES_URL=`.

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

### Step 1 sanity check

- [ ] All nine variables have non-empty values (no trailing spaces).
- [ ] `POSTGRES_URL` is a single connection string.
- [ ] `REDIS_URL` starts with `rediss://` (typical for Upstash).
- [ ] `QSTASH_TOKEN` starts with `ey` (it's a JWT).
- [ ] `RESEND_API_KEY` starts with `re_`.

---

## Step 2 — Install dependencies (if you have not already)

```bash
cd /path/to/front-desk-chatbot
corepack enable && corepack prepare pnpm@10.32.1 --activate
pnpm install
```

---

## Step 3 — Run database migrations

With `POSTGRES_URL` set in `.env.local`:

```bash
pnpm db:migrate
```

This applies `lib/db/migrations/` (including front-desk tables).

---

## Step 4 — Start the app locally

```bash
pnpm dev
```

Open the URL shown (usually `http://localhost:3000`). Register or use guest login, then visit `/onboarding` to configure the business profile.

---

## Step 5 — Optional demo data

```bash
pnpm db:seed
```

Creates a demo user and sample businesses (see `lib/db/seed.ts`). Use only on a dev database.

---

## Step 6 — Deploy to Vercel (when ready)

1. Push the repo to GitHub (or use Vercel CLI `vercel link`).
2. **Import** the repo in Vercel → set the same env vars in **Project → Settings → Environment Variables** (except you often **omit** `AI_GATEWAY_API_KEY` in production if OIDC is used—see [DEPLOY.md](DEPLOY.md)).
3. Deploy, then run `pnpm db:migrate` against production **or** run migrations from CI / local with `POSTGRES_URL` pointing at production (careful).

More detail: [DEPLOY.md](DEPLOY.md).
