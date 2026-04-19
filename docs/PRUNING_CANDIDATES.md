# Pruning candidates (audit)

**Purpose:** Optional **single-owner** simplifications—remove or gate features you never use. Do not delete large areas without `pnpm check`, `pnpm build`, and manual smoke tests.

**Status:** Inventory only—no obligation to delete.

**Note:** Multi-tenant **business / front-desk** routes, **escalations**, **onboarding**, and related **schema** were **removed from the repo** (2026-04). This document no longer lists them; see git history if you need that context.

## Gateway-only and meta-product tooling

| Area | Notes |
|------|--------|
| `lib/ai/tools/submit-product-opportunity.ts`, [github-product-opportunity.md](github-product-opportunity.md) | Opens GitHub Issues from chat; **gateway models only**. |
| `docs/tickets/future-monetization-product-opportunity-limits.md` | Caps and ops—only relevant if you treat feedback volume as a cost center. |

## Agent task queue

| Area | Notes |
|------|--------|
| `lib/ai/tools/submit-agent-task.ts`, `lib/agent-tasks/*`, `app/(chat)/agent-tasks/*`, related API routes | Self-improvement task queue + optional GitHub mirror. |

## Guest and demo affordances

| Area | Notes |
|------|--------|
| `app/(auth)/api/auth/guest/route.ts` | Guest login; main product loop is signed-in owner ([docs/PROJECT.md](PROJECT.md)). |
| `lib/db/query-modules/users.ts`, `lib/db/seed.ts` | Demo users / seed data for dev. |

## Optional high-surface features

| Area | Notes |
|------|--------|
| `lib/ai/tools/jira.ts` | Jira integration—only if you use it. |
| Sophon (`app/(chat)/sophon/`, `lib/db/query-modules/sophon.ts`, `sophon/`) | Daily command center—remove only if you do not use the UI/API. |
| `digital-self/` sibling package | Separate app; main Next app excludes it in `tsconfig`—drop the folder only if you abandon that integration. |

## Documentation to trim or soften (optional)

- Tone in `README.md` can stay aligned with [OWNER_PRODUCT_VISION.md](OWNER_PRODUCT_VISION.md) as you refine positioning.

## Suggested process

1. Pick one vertical (e.g. guest auth, or GitHub product-opportunity) and confirm you never need it.
2. Remove routes + UI + tools + schema only if you accept a migration for DB cleanup.
3. Drop unused `package.json` dependencies after code removal.
4. Re-run `pnpm check` and `pnpm build`.
