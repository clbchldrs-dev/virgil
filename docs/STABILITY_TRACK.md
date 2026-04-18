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

For chat observability/cost checks, use the v2-eval flags exactly as implemented in `app/(chat)/api/chat/route.ts`:

- **`V2_TRACE_LOGGING=true`** -> writes decision traces to `workspace/v2-eval/traces.jsonl` via `logDecisionTrace(...)`, including `preStreamTimingsMs` (`authAndBotCheck`, `promptContextLoad`, `totalBeforeFirstModelCall`).
- **`V2_EVAL_LOGGING=true`** -> writes interaction records to `workspace/v2-eval/interactions.jsonl` via `logInteraction(...)`; also enables cost log writes.
- **`V2_COST_LOGGING=true`** -> enables `workspace/v2-eval/costs.jsonl` writes via `logGatewayCost(...)` even when `V2_EVAL_LOGGING` is off.

Cost log nuance: `costs.jsonl` only records fallback tiers `gateway` and `gemini` (local-only ollama turns are intentionally skipped).

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

- [x] **Runbook** — [Phase C runbook](#phase-c-runbook-security--ongoing) below.
- [ ] **Triage** — Skim [docs/security/tool-inventory.md](security/tool-inventory.md) and [security hardening plan](superpowers/plans/2026-03-29-security-hardening-agents.md); enable **`BOTID_ENFORCE=1`** on public Vercel if bots are a concern; run `pnpm audit` periodically (plan D1).

### Phase D — Background and schedules

- [x] **Runbook** — [Phase D runbook](#phase-d-runbook-background--schedules) below.
- [ ] **Verified** — Cron / QStash reach your app with correct `CRON_SECRET` and origin env (`AUTH_URL`, `NEXT_PUBLIC_APP_URL`); self-host: curl or systemd tested once ([AGENTS.md](../AGENTS.md#scheduled-jobs-on-the-host-no-vercel-cron)).

### Phase E — Product feedback (non-blocking)

- [ ] Use [workspace/v2-eval/README.md](../workspace/v2-eval/README.md) to capture misses/noise.
- [ ] Enable eval flags intentionally when collecting evidence:
  - `V2_TRACE_LOGGING=true` (startup timing / routing trace)
  - `V2_EVAL_LOGGING=true` (interaction log + gateway/gemini cost log)
  - `V2_COST_LOGGING=true` (cost log only, if you want minimal overhead)

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

## Phase C runbook (security — ongoing)

**Goal:** You know what LLM tools and API routes can do, and you have triaged optional hardening for **your** exposure (LAN-only vs public internet).

### 1. Read the inventory (≈15 min)

- [docs/security/tool-inventory.md](security/tool-inventory.md) — tool risk table, **background auth matrix** (cron vs QStash), file uploads, **IDOR** patterns and `lib/security/idor.ts`.
- If OpenClaw delegation is enabled, also verify tunnel-first defaults in [docs/openclaw-ssh-tunnel-hardening.md](openclaw-ssh-tunnel-hardening.md) and [docs/openclaw-bridge.md](openclaw-bridge.md).

### 2. Hardening plan status

- [docs/superpowers/plans/2026-03-29-security-hardening-agents.md](superpowers/plans/2026-03-29-security-hardening-agents.md) — Phases A–D; many items are **done** in-repo; open items (e.g. D1 `pnpm audit`) are periodic.

### 3. Public chat surface (Vercel / internet)

- Optional **`BOTID_ENFORCE=1`** — blocks suspicious BotId results on `POST /api/chat` ([`lib/security/botid-chat.ts`](../lib/security/botid-chat.ts), env in [AGENTS.md](../AGENTS.md)).
- Rate limits: [`lib/ratelimit.ts`](../lib/ratelimit.ts); optional stricter guest caps stay policy-only unless you change code.

### 4. Close Phase C

Check **Triage** under [Phase C](#phase-c--security-and-abuse-ongoing) when you have skimmed the inventory and noted anything you will schedule (or explicitly accept as-is).

---

## Phase D runbook (background & schedules)

**Goal:** Scheduled jobs can authenticate to your app and use the **same origin** users use in the browser.

### 1. Vercel

- **`CRON_SECRET`** — Must match the Bearer token Vercel Cron sends to `/api/digest` and `/api/night-review/enqueue` ([vercel.json](../vercel.json), [vercel-env-setup.md](vercel-env-setup.md)).
- **`NEXT_PUBLIC_APP_URL` / `AUTH_URL`** — QStash and enqueue use your deployed base URL; wrong values break night-review and reminders ([AGENTS.md](../AGENTS.md#step-1--fill-credentials-in-envlocal) deployment notes).

### 2. Self-hosted (no Vercel Cron)

- Use the **curl** or **systemd** examples in [AGENTS.md § Scheduled jobs on the host](AGENTS.md#scheduled-jobs-on-the-host-no-vercel-cron) with the same `CRON_SECRET` and **`APP_URL`** your users open.

### 3. QStash-signed routes

- `/api/night-review/run`, `/api/reminders` — signature verification, not Bearer cron secret; matrix in [tool-inventory.md § Background routes](security/tool-inventory.md#background-routes--authentication-matrix).

### 4. Close Phase D

Check **Verified** under [Phase D](#phase-d--background-and-schedules) after one successful cron or manual curl to digest/enqueue (or documented equivalent on your host).

---

## What not to do on the stability track

- Do not treat **v2 architecture** ([V2_ARCHITECTURE.md](V2_ARCHITECTURE.md)) as in-scope for “stable v1”—note issues, defer large rewrites.
- Do not expand prompts or tools without running `pnpm stable:check` and relevant tests.

---

## Session handoff

When pausing stability work, update [STABLE_STOP_HANDOFF.md](STABLE_STOP_HANDOFF.md) with last passing commands and any new warnings. Use [docs/PROJECT.md](PROJECT.md) agent handoff section for branch/goal context.
