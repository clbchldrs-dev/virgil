# Future — Monetization phase: product-opportunity caps & gateway rate limits

**Audience:** When Virgil moves beyond **personal use** toward paid or multi-tenant offerings.  
**Status:** Backlog — not required for current personal-use phase.

## Context

Today, `submitProductOpportunity` shares the same **session + IP + hourly message** limits as the rest of chat ([`app/(chat)/api/chat/route.ts`](../../app/(chat)/api/chat/route.ts)). There is **no** per-user cap on successful GitHub Issues filed per day/week.

## Proposed work (when monetizing)

1. **Per-user / per-tenant issue quota** — e.g. max N successful `createProductOpportunityIssue` calls per rolling window; store counts in Redis or Postgres; return a clear tool error when exceeded.
2. **Stricter rate limits** on gateway chat for tiers that include “file feedback” — separate from generic message limits if abuse patterns differ.
3. **Audit log** — optional row per submission (hashed user id, timestamp, issue number) for support and billing disputes.
4. **Docs** — [github-product-opportunity.md](../github-product-opportunity.md), [AGENTS.md](../../AGENTS.md#deployment-production), pricing page.

## Related

- [docs/superpowers/plans/2026-03-29-security-hardening-agents.md](../superpowers/plans/2026-03-29-security-hardening-agents.md)  
- E6 / [`sanitizeProductOpportunityToolError`](../../lib/github/product-opportunity-issue.ts)
