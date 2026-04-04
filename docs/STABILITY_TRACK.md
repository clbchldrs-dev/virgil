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

- [ ] Document or verify production env parity ([docs/vercel-env-setup.md](vercel-env-setup.md) if on Vercel).
- [ ] One successful `pnpm db:migrate` against the environment you ship to.

### Phase C — Security and abuse (ongoing)

- [ ] Skim [docs/security/tool-inventory.md](security/tool-inventory.md) and open items in [security hardening plan](superpowers/plans/2026-03-29-security-hardening-agents.md) that match your threat model (LAN vs public, BotId, rate limits).

### Phase D — Background and schedules

- [ ] Night review / digest / cron: auth header and `NEXT_PUBLIC_APP_URL` / `AUTH_URL` consistent ([AGENTS.md](../AGENTS.md#scheduled-jobs-on-the-host-no-vercel-cron)).
- [ ] Self-hosted: systemd or crontab entries tested once.

### Phase E — Product feedback (non-blocking)

- [ ] Use [workspace/v2-eval/README.md](../workspace/v2-eval/README.md) to capture misses/noise; optional `V2_EVAL_LOGGING` when instrumented.

---

## What not to do on the stability track

- Do not treat **v2 architecture** ([V2_ARCHITECTURE.md](V2_ARCHITECTURE.md)) as in-scope for “stable v1”—note issues, defer large rewrites.
- Do not expand prompts or tools without running `pnpm stable:check` and relevant tests.

---

## Session handoff

When pausing stability work, update [STABLE_STOP_HANDOFF.md](STABLE_STOP_HANDOFF.md) with last passing commands and any new warnings. Use [docs/PROJECT.md](PROJECT.md) agent handoff section for branch/goal context.
