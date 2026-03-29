# VIRG-E2 — Per-model prompt variants (3B vs 7B)

**Enhancement ID:** E2 ([ENHANCEMENTS.md](../ENHANCEMENTS.md))  
**Roadmap:** [Phase Two](../VIRGIL_ROADMAP_LINUX_24_7.md#phase-two-intelligence-refinement-and-context-discipline-e2-e3)  
**Status:** Partially shipped (2026-03-29) — `LocalModelClass` + slim/compact differentiation; further variants still TBD

## Problem

Local models share **`full` / `slim` / `compact`** tiers, but **3B-class** and **7B-class** models differ in instruction-following, tool reliability, and tokenization. One-size prompts leave quality on the table or encourage brittle behavior.

## Goal

Extend **`lib/ai/models.ts`** and **`app/(chat)/api/chat/route.ts`** (and related prompt builders under `lib/ai/*-prompt.ts`) so **model-specific instruction sets** can be selected safely—optimized per capability class—without increasing **sycophancy** (clarity over flattery; [AGENTS.md](../../AGENTS.md)).

## Scope

- [x] Define a small matrix: `(promptVariant × LocalModelClass)` for **local Ollama** slim/compact builders; curated `localModelClass` + tag inference for unknown tags.
- [x] Defaults remain **personal / non-business** unless business mode is on; gateway path unchanged.
- [x] No new env vars; data in `models.ts` + `ollama-discovery` for discovered tags.
- [x] Unit tests: `tests/unit/local-model-class.test.ts`, extended `local-context.test.ts`.
- [ ] Optional follow-up: per-model tweaks beyond 3B/7B buckets, or `full`-variant class splits.

## Non-goals

- Rewriting all prompts from scratch in one PR.
- Adding new cloud-only models.

## Acceptance criteria

1. Chat route selects prompts using **model identity** (or derived class), not only `full`/`slim`/`compact`.
2. **DECISIONS.md** or a short ADR notes the variant scheme if it affects maintainers.
3. `pnpm check` passes; no regression in gateway path.

## Key files (starting points)

- `lib/ai/models.ts`, `lib/ai/providers.ts`
- `app/(chat)/api/chat/route.ts`
- `lib/ai/*-prompt.ts`, `lib/ai/ollama-discovery.ts`

## Delegation

Suitable for an agent with **read codebase → implement selection + tests → doc**. Independent of E3 until shared trim/prompt coupling appears.

**Explore handoff:** [2026-03-29-delegation-handoffs.md](2026-03-29-delegation-handoffs.md) (VIRG-E2 section).
