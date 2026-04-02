# V2-T8 — Persona SSOT (`VIRGIL_PERSONA.md`) + prompt code sync

**Track:** V2 groundwork — [overview](2026-04-01-v2-groundwork-overview.md)  
**Status:** Blocked on human — complete [personality workbook](../personality/Virgil_personality_synthesis.md) first

## Problem

Personality rules are **split** across [`lib/ai/companion-prompt.ts`](../../lib/ai/companion-prompt.ts), [`lib/ai/slim-prompt.ts`](../../lib/ai/slim-prompt.ts), and [`lib/ai/goal-guidance-prompt.ts`](../../lib/ai/goal-guidance-prompt.ts). v2 expects a versioned **`persona.md`**. v1 has no single human-edited SSOT file that developers read before editing TypeScript.

## Goal

1. Add **`docs/VIRGIL_PERSONA.md`**: the **authoritative** voice spec (sections: identity, always/never, local vs hosted deltas, fitness/goals stance, tool behavior summary). Content comes from the filled **synthesis worksheet** in the workbook DOCX/MD—not invented by the agent.
2. Update **TypeScript builders** so they **quote or closely follow** the SSOT (reduce drift); keep tokens lean on slim—may be “see VIRGIL_PERSONA §4” style only if unacceptable to duplicate.
3. Cross-link from [V2_MIGRATION.md](../V2_MIGRATION.md) (“Port persona → persona.md”) to `docs/VIRGIL_PERSONA.md` as the v1 source.
4. Add ADR snippet or [DECISIONS.md](../DECISIONS.md) note: “Persona SSOT file + code sync policy.”

## Non-goals

- Changing product vision in [OWNER_PRODUCT_VISION.md](../OWNER_PRODUCT_VISION.md) unless the workbook explicitly directs it.
- Business/front-desk persona (optional appendix only).

## Acceptance criteria

1. `docs/VIRGIL_PERSONA.md` exists and is linked from [docs/PROJECT.md](../PROJECT.md) SSOT table.
2. `buildCompanionSystemPrompt` / `buildSlimCompanionPrompt` / `buildCompactCompanionPrompt` (and goal appendix if affected) align with SSOT; tests updated if snapshots exist (`tests/unit/local-context.test.ts`).
3. `pnpm check` / targeted tests pass.

## Key files

- `docs/personality/Virgil_personality_synthesis.md` (worksheet output)
- `lib/ai/companion-prompt.ts`, `lib/ai/slim-prompt.ts`, `lib/ai/goal-guidance-prompt.ts`
- `docs/PROJECT.md`, `docs/DECISIONS.md`
