# Documentation index

**Current onboarding (use this order):**

1. **[README.md](README.md)** — clone, `pnpm install`, `pnpm db:migrate`, `pnpm dev`, Docker one-liner.
2. **[SETUP.md](SETUP.md)** — condensed setup + env pointers (full procedures stay in AGENTS).
3. **[docs/PROJECT.md](docs/PROJECT.md)** — product intent, SSOT map, agent handoff.
4. **[AGENTS.md](AGENTS.md)** — authoritative setup steps, deployment, env var tables, coding rules.

**Vercel / production env copy order:** [docs/vercel-env-setup.md](docs/vercel-env-setup.md) (dashboard ↔ `.env.local` via `pnpm env:vercel:pull`).

---

## By topic

| Need | Go to |
|------|--------|
| Full env catalog & step-by-step setup | [AGENTS.md](AGENTS.md) — Setup checklist |
| Production deploy & Vercel vars | [AGENTS.md](AGENTS.md) — Deployment (production); [docs/vercel-env-setup.md](docs/vercel-env-setup.md) |
| Architecture decisions | [docs/DECISIONS.md](docs/DECISIONS.md) |
| Stability / verification gates | [docs/STABILITY_TRACK.md](docs/STABILITY_TRACK.md) |
| Quotas vs features (free tier) | [docs/free-tier-feature-map.md](docs/free-tier-feature-map.md) |
| OpenClaw / Hermes / delegation | [docs/openclaw-bridge.md](docs/openclaw-bridge.md), [AGENTS.md](AGENTS.md) |
| Command center / operator runbooks | [docs/operator-integrations-runbook.md](docs/operator-integrations-runbook.md) |
| Night review (workspace prompts) | [workspace/night/README.md](workspace/night/README.md) |
| v2 (planned, not active in repo) | [docs/V2_ARCHITECTURE.md](docs/V2_ARCHITECTURE.md) |
| Enhancement backlog | [docs/ENHANCEMENTS.md](docs/ENHANCEMENTS.md) |
| Work tickets / epics | [docs/tickets/README.md](docs/tickets/README.md) |

**Deep reference** (roadmaps, specs, audits): see the tables in [docs/PROJECT.md](docs/PROJECT.md).

---

## Historical — Phase 1 implementation package (January 2024)

All artifacts live under **[docs/archive/phase1/](docs/archive/phase1/README.md)** (ADR-002, Cursor prompts, timelines, checklists). They are **not** the live onboarding path; examples may say `npm` where the repo uses `pnpm`.

**Compatibility:** Short **stub** files remain at the old root and `docs/` paths (e.g. [QUICK_START.txt](QUICK_START.txt), [docs/ADR-002-three-paths-virgil.md](docs/ADR-002-three-paths-virgil.md)) and point to the archive.

Pre-ship sketches (separate): [docs/archive/README.md](docs/archive/README.md).
