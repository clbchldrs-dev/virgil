# VIRG-P4 — Production hardening: host cron, LAN auth, env documentation

**Roadmap:** [Phase Four](../VIRGIL_ROADMAP_LINUX_24_7.md#phase-four-247-production-hardening-and-lan-operations)  
**Status:** Shipped (2026-03-29) — detail in AGENTS.md; thin SETUP/DEPLOY hubs; AGENTS checklist note below

## Problem

24/7 **Ubuntu** operation should not depend solely on **Vercel Cron**; **LAN** auth must stay consistent when the app is reached by **static IP**; **new env vars** must appear in **AGENTS.md** (Setup checklist + Deployment).

## Sub-tasks

### P4.1 — Host cron / systemd timers

- [x] Inventory: [`vercel.json`](../../vercel.json) — `/api/night-review/enqueue` 03:00 UTC, `/api/digest` 08:00 UTC.
- [x] [AGENTS.md § Scheduled jobs](../../AGENTS.md#scheduled-jobs-on-the-host-no-vercel-cron) — `curl` + `crontab` + `systemd` timer examples, UTC / timesync notes.

### P4.2 — LAN origin hardening

- [x] [AGENTS.md — Deployment (production)](../../AGENTS.md#deployment-production) self-hosted notes + env table rows for `AUTH_URL`, `NEXT_PUBLIC_APP_URL`, `VERCEL_URL`, `OLLAMA_BASE_URL`, `VIRGIL_OPEN_URL`.
- [x] Stable IP / netplan / one-origin rule cross-linked to [beta-lan-gaming-pc.md](../beta-lan-gaming-pc.md).

### P4.3 — AGENTS.md + thin SETUP/DEPLOY audit

- [x] Review checklist: default chat path remains personal; business mode opt-in — no code change required; Key Decisions updated.
- [x] Env SSOT: AGENTS.md Deployment §6 table extended; scheduled-jobs section links digest + enqueue.

## Acceptance criteria

1. A LAN-only operator can run scheduled jobs **without Vercel**.
2. Auth URLs documented end-to-end for static IP.
3. Env SSOT complete for beta operators.

## Key files

- `AGENTS.md`, thin `SETUP.md` / `DEPLOY.md` hubs, `app/api` cron routes, `vercel.json` (if present)

## Delegation

Single **ops/docs** agent can own all three sub-tasks; split into separate PRs if large.

**Explore handoff:** [2026-03-29-delegation-handoffs.md](2026-03-29-delegation-handoffs.md) (VIRG-P4 section).
