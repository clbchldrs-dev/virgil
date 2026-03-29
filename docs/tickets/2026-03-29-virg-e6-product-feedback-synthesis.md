# VIRG-E6 — Product feedback + external synthesis (OpenClaw / agentic ideas)

**Enhancement ID:** E6 ([ENHANCEMENTS.md](../ENHANCEMENTS.md))  
**Roadmap:** [Phase Three](../VIRGIL_ROADMAP_LINUX_24_7.md#phase-three-memory-synthesis-and-feedback-integration-e6-e7)  
**Status:** Partially shipped (2026-03-29) — docs + error sanitization; periodic synthesis still manual

## Problem

Ideas from **external agentic ecosystems** (e.g. [OpenClaw](https://github.com/openclaw/openclaw)) should inform **Virgil scope** without turning the repo into an unstructured wishlist.

## Goal

- **In-app:** `submitProductOpportunity` → GitHub Issues ([github-product-opportunity.md](../github-product-opportunity.md)) — verify and harden as needed.
- **Process:** Periodic **synthesis pass**: curated bullets into [ENHANCEMENTS.md](../ENHANCEMENTS.md) or [VIRGIL_ROADMAP_LINUX_24_7.md](../VIRGIL_ROADMAP_LINUX_24_7.md) — **human-reviewed**, not autonomous prompt edits.

## Scope

- [x] Audit: local Ollama omits tool; gateway registers it when `isProductOpportunityConfigured`; reasoning models with `experimental_activeTools: []` cannot invoke tools — documented.
- [x] Synthesis cadence: **owner-defined** (e.g. monthly); **human** adds ENHANCEMENTS / roadmap rows — documented in [github-product-opportunity.md](../github-product-opportunity.md).
- [x] Template: synthesis subsection + bullets in same doc.
- [x] Tool errors sanitized via `sanitizeProductOpportunityToolError` in [`lib/github/product-opportunity-issue.ts`](../../lib/github/product-opportunity-issue.ts).

## Acceptance criteria

1. Documented workflow from **in-app submission** → **Issue** → **backlog row** (when accepted).
2. No automatic merge of user feedback into **core system prompts** (suggest-only / human review).

## Key files

- `docs/github-product-opportunity.md`
- Search: `submitProductOpportunity`, GitHub API usage, `lib/ai/tools` or app routes

## Delegation

Lighter **docs + API audit** ticket; can parallelize with E7.

**Explore handoff:** [2026-03-29-delegation-handoffs.md](2026-03-29-delegation-handoffs.md) (VIRG-E6 section).
