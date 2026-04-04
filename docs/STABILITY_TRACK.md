# Virgil stability track

Use this when the goal is **reliable daily use**: predictable builds, safe deploys, and a clear verification loop—not feature velocity.

**Related:** [STABLE_STOP_HANDOFF.md](STABLE_STOP_HANDOFF.md) (resume after a pause), [AGENTS.md](../AGENTS.md) (review / handoff checklists), [security/tool-inventory.md](security/tool-inventory.md).

---

## Definition: “stable” for v1

| Layer | Meaning |
|--------|--------|
| **Local dev** | `pnpm stable:check` passes; `pnpm dev` runs with documented env. |
| **Build** | `pnpm build` succeeds when Postgres is reachable (migrations run). |
| **Data** | Migrations applied; no schema drift surprises (`pnpm db:migrate` in deploy path). |
| **Background** | Cron/QStash documented; secrets not in repo ([AGENTS.md](../AGENTS.md#scheduled-jobs-on-the-host-no-vercel-cron)). |
| **Trust** | Security inventory + hardening backlog triaged ([security-hardening plan](superpowers/plans/2026-03-29-security-hardening-agents.md)). |

---

## Commands (copy order)

**Fast gate (no DB required for migrate step):**

```bash
pnpm stable:check
```

Runs: `pnpm check` → `pnpm run type-check` → `pnpm test:unit`.

**Full gate (needs `POSTGRES_URL` / DB reachable for `tsx lib/db/migrate`):**

```bash
pnpm stable:check:full
```

Runs `stable:check`, then `pnpm build`.

**Optional:** `pnpm ollama:smoke` after model/routing changes; `pnpm test` for Playwright when UI/auth paths change.

---

## Phased work (in order)

### Phase A — Baseline (this week)

- [x] Run `pnpm stable:check` on a clean tree; fix anything that fails.
- [x] Run `pnpm stable:check:full` against a dev database; note any Turbopack/NFT warnings from [STABLE_STOP_HANDOFF.md](STABLE_STOP_HANDOFF.md).
- [ ] Confirm `.env.local` matches [AGENTS.md](../AGENTS.md#setup-checklist) for features you use (auth, DB, Redis, optional Ollama URL).

### Phase B — Deploy path

- [x] **Runbook** — [Phase B runbook](#phase-b-runbook-deploy-path) below; Vercel copy order in [docs/vercel-env-setup.md](vercel-env-setup.md).
- [ ] **Production env** — Variables on the host you ship to match [AGENTS.md](../AGENTS.md#deployment-production) / [vercel-env-setup.md](vercel-env-setup.md) (including `AUTH_URL` + `NEXT_PUBLIC_APP_URL` same origin).
- [ ] **Production migrate** — One successful `POSTGRES_URL='…' pnpm db:migrate` against the **live** Postgres (not only dev). See runbook §3.

### Phase C — Security and abuse (ongoing)

- [ ] Skim [docs/security/tool-inventory.md](security/tool-inventory.md) and open items in [security hardening plan](superpowers/plans/2026-03-29-security-hardening-agents.md) that match your threat model (LAN vs public, BotId, rate limits).

### Phase D — Background and schedules

- [ ] Night review / digest / cron: auth header and `NEXT_PUBLIC_APP_URL` / `AUTH_URL` consistent ([AGENTS.md](../AGENTS.md#scheduled-jobs-on-the-host-no-vercel-cron)).
- [ ] Self-hosted: systemd or crontab entries tested once.

### Phase E — Product feedback (non-blocking)

- [ ] Use [workspace/v2-eval/README.md](../workspace/v2-eval/README.md) to capture misses/noise; optional `V2_EVAL_LOGGING` when instrumented.

---

## Phase B runbook (deploy path)

**Goal:** Schema on the database you ship to matches `lib/db/migrations/`, and auth/origin URLs match how users open the app.

### 1. Pick your deployment doc

| Where you ship | Start here |
|----------------|------------|
| **Vercel + Neon** | [docs/vercel-env-setup.md](vercel-env-setup.md) |
| **Docker / LAN / self-host** | [AGENTS.md](../AGENTS.md#deployment-production), [docs/beta-lan-gaming-pc.md](beta-lan-gaming-pc.md) if applicable |

#### Vercel + Neon — ordered checklist

**Search:** Vercel, Neon, production, deploy. Authoritative copy order: [vercel-env-setup.md](vercel-env-setup.md).

1. **Import** the GitHub repo in the Vercel dashboard (or `vercel link` from the repo root).
2. **Production env vars** — Set variables for **Production** using [vercel-env-setup.md § Required](vercel-env-setup.md#required-for-a-working-production-app): `AUTH_SECRET`, `POSTGRES_URL`, `REDIS_URL`, `BLOB_READ_WRITE_TOKEN`, QStash keys, `RESEND_API_KEY`, `CRON_SECRET`, `AUTH_URL`, `NEXT_PUBLIC_APP_URL`. The last two must match the **exact** origin users open (including `https`).
3. **AI Gateway** — Usually **omit** `AI_GATEWAY_API_KEY` on Vercel when OIDC applies; keep it in `.env.local` for local dev ([AGENTS.md](../AGENTS.md#environment-variable-summary)).
4. **Deploy** — Push to `main` or deploy from the dashboard. **Redeploy** after any change to `NEXT_PUBLIC_APP_URL` so the client bundle updates.
5. **Migrate production Postgres** — From a trusted machine: `POSTGRES_URL='…' pnpm db:migrate` with Neon’s **production** connection string (same as step 2; see §3 below).
6. **Vercel Cron** — Set `CRON_SECRET` so cron routes in [vercel.json](../vercel.json) receive the expected Bearer token ([vercel-env-setup.md § After first deploy](vercel-env-setup.md#after-first-deploy)).
7. **Smoke** — Open `AUTH_URL`, sign in, confirm chat persists on a phone using the same origin if you test mobile.

### 2. Env parity

Set required vars on **Production** (or your live host). Minimum: `AUTH_SECRET`, `POSTGRES_URL`, `REDIS_URL`, `BLOB_READ_WRITE_TOKEN`, QStash keys, `RESEND_API_KEY`, `CRON_SECRET`, `AUTH_URL`, `NEXT_PUBLIC_APP_URL` — full table in [AGENTS.md](../AGENTS.md#environment-variable-summary) and Vercel-focused notes in [vercel-env-setup.md](vercel-env-setup.md#required-for-a-working-production-app).

`AUTH_URL` and `NEXT_PUBLIC_APP_URL` must be the **exact** origin users type in the address bar. After changing `NEXT_PUBLIC_APP_URL`, **redeploy** so the client bundle picks it up.

### 3. Migrations on production Postgres

From a **trusted machine** (avoid logging the URL in shared terminals):

```bash
cd /path/to/virgil
POSTGRES_URL='postgresql://…' pnpm db:migrate
```

Use the connection string for the **Neon (or other) database that production uses**, not your dev branch unless they are the same.

**Dev-only check:** `pnpm db:migrate` with `.env.local` confirms the migration runner works; it does **not** replace production migrate.

### 4. Smoke after deploy

- Open `AUTH_URL`, sign in, confirm chat persists.
- If using [Vercel Cron](../vercel.json): `CRON_SECRET` must match the Bearer token; see [vercel-env-setup.md § After first deploy](vercel-env-setup.md#after-first-deploy).

### 5. Close Phase B

Check **Production env** and **Production migrate** under [Phase B](#phase-b--deploy-path) when steps 2–4 are true for your live stack.

---

## What not to do on the stability track

- Do not treat **v2 architecture** ([V2_ARCHITECTURE.md](V2_ARCHITECTURE.md)) as in-scope for “stable v1”—note issues, defer large rewrites.
- Do not expand prompts or tools without running `pnpm stable:check` and relevant tests.

---

## Session handoff

When pausing stability work, update [STABLE_STOP_HANDOFF.md](STABLE_STOP_HANDOFF.md) with last passing commands and any new warnings. Use [docs/PROJECT.md](PROJECT.md) agent handoff section for branch/goal context.
