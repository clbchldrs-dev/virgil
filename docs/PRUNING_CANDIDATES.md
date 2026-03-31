# Pruning candidates (audit)

**Purpose:** This fork is **bespoke single-owner**. Code paths that existed for multi-tenant demos, business front-desk, or gateway marketing tools may be **candidates to remove or stub** once you confirm you do not use them. Do not delete large areas without `pnpm check`, `pnpm build`, and manual smoke tests.

**Status:** Inventory only—no obligation to delete.

## Business / front-desk

| Area | Notes |
|------|--------|
| `lib/ai/front-desk-prompt.ts`, `buildSlimFrontDeskPrompt` / `buildCompactFrontDeskPrompt` in `lib/ai/slim-prompt.ts` | Used when a business profile is active. |
| `lib/db/query-modules/business.ts`, business tables in `lib/db/schema.ts` | Intake, escalations, business profile. |
| `lib/ai/tools/record-intake.ts`, `escalate-to-human.ts`, `summarizeOpportunity.ts` | Business-mode tools. |
| `app/(chat)/onboarding/*` | Business onboarding. |
| `app/(chat)/escalations/*`, `app/(chat)/api/escalations/*` | Owner escalations. |

## Gateway “product” and agent task tooling

| Area | Notes |
|------|--------|
| `lib/ai/tools/submit-product-opportunity.ts`, `docs/github-product-opportunity.md` | GitHub issues for product feedback; gateway-only. |
| `lib/ai/tools/submit-agent-task.ts`, `lib/agent-tasks/*`, agent task API | Self-improvement task queue. |
| `docs/tickets/future-monetization-product-opportunity-limits.md` | Monetization caps—irrelevant to bespoke personal use. |

## Guest and multi-user affordances

| Area | Notes |
|------|--------|
| `app/(auth)/api/auth/guest/route.ts` | Guest login flow. |
| `lib/db/query-modules/users.ts`, `lib/db/seed.ts` | Demo users / seed data. |

## Documentation to trim or soften (optional)

- References to “product,” “clients,” or “business mode” in `README.md` / marketing tone can be narrowed to match [OWNER_PRODUCT_VISION.md](OWNER_PRODUCT_VISION.md).

## Suggested process

1. Pick one vertical (e.g. guest auth, or business tools) and confirm you never need it.
2. Remove routes + UI + tools + schema only if you accept a migration for DB cleanup.
3. Drop unused `package.json` dependencies after code removal.
4. Re-run `pnpm check` and `pnpm build`.
