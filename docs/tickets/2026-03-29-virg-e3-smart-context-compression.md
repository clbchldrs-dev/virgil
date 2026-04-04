# VIRG-E3 — Smart context compression (`trim-context`)

**Enhancement ID:** E3 ([ENHANCEMENTS.md](../ENHANCEMENTS.md))  
**Roadmap:** [Phase Two](../VIRGIL_ROADMAP_LINUX_24_7.md#phase-two-intelligence-refinement-and-context-discipline-e2-e3)  
**Status:** Shipped (2026-04) — overhead + long-message compression + middle shrink prefers removable assistant over removable user; preserves AI SDK tool-call/tool-result/approval parts until last resort

## Problem

Local models run under **aggressive token budgets**. Current trimming may drop continuity or over-retain low-value tokens.

## Goal

Evolve **`lib/ai/trim-context.ts`** (and call sites in the chat route) to preserve **continuity**—recent user turns, critical system facts, memory snippets—within budget, using predictable rules (not black-box “AI summarization” unless explicitly approved).

## Scope

- [x] Audit: long-thread path keeps `first` + greedy **newest-first** middle + tail; short history collapses to last + truncate; documented in ADR.
- [x] **Tiered:** per-message overhead; **compressLongMessage** for user + assistant over threshold (was assistant-only).
- [x] **Local vs gateway:** unchanged — trim only in `route.ts` for Ollama local.
- [x] Tests: `tests/unit/trim-context.test.ts` + existing `local-context` trim tests.
- [x] Middle-phase preference: `shrinkMiddleTrialToBudget` drops removable **assistant** turns before removable **user** turns; skips messages with tool structural parts (`role: tool` or `tool-call` / `tool-result` / approval parts) until last resort (oldest drop).
- [x] Tool-part preservation: `isToolStructuralMessage` + skip `compressLongMessage` / `truncateMessageToBudget` for structural messages.

## Non-goals

- Doubling context window via cloud summarization on every turn (unless behind a flag and documented).

## Acceptance criteria

1. Measurable improvement in **retained recent turns** under fixed budgets (test fixtures or documented before/after).
2. No increase in flattery or “assistant persona” padding—**clarity over filler**.
3. `pnpm check` passes.

## Key files

- `lib/ai/trim-context.ts`
- `app/(chat)/api/chat/route.ts` (call sites)
- `tests/unit/local-context.test.ts` (if present)

## Delegation

Can run **after or in parallel with E2**; merge conflicts possible in `route.ts`—coordinate or sequence if both touch the same lines.

**Explore handoff:** [2026-03-29-delegation-handoffs.md](2026-03-29-delegation-handoffs.md) (VIRG-E3 section).
