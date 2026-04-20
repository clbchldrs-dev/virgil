---
title: "refactor: In-process companion tool failure shape (non-Jira)"
type: refactor
status: completed
date: 2026-04-20
origin: docs/brainstorms/2026-04-20-companion-in-process-tool-result-shape-requirements.md
---

# refactor: In-process companion tool failure shape (non-Jira)

## Overview

Establish **normalized failure payloads** for hosted in-process companion tools using `lib/ai/companion-tool-result.ts` (`CompanionToolFailure` / `companionToolFailure`), aligned with delegation-style semantics (`ok: false`, `error`, `errorCode`, `retryable`, `message`, optional `hint`). **Priority tools** (briefing, calendar, weather, recall/save memory) already use this helper; the companion prompt already tells the model to treat `ok: false` + `errorCode` / `retryable` as authoritative for those families (see `lib/ai/companion-prompt.ts`).

**Owner decision (2026-04-20):** **Jira is explicitly out of scope** — no migration of `lib/ai/tools/jira.ts` to `companionToolFailure`, no prompt work targeted at Jira failure shape. Jira may continue returning legacy `{ error: string }` until someone prioritizes it.

## Problem Frame

Same as origin for tools we care about: one failure mental model for config-sensitive in-process tools so the model does not invent success or misread recoverability (see origin: `docs/brainstorms/2026-04-20-companion-in-process-tool-result-shape-requirements.md`). Jira parity is **not** required for that goal given owner preference.

## Requirements Trace

Satisfied for **in-scope** tools (non-Jira):

- **R1–R2:** Normalized failures via `companionToolFailure` for briefing, calendar, weather, recall/save memory — **implemented** in `lib/ai/tools/`.
- **R3:** Prompt alignment for structured failures — **implemented** in `buildCompanionToolGuidance` (delegation block + calendar + line covering `ok: false` / `errorCode` / `retryable` for calendar, weather, memory, getBriefing).
- **R4:** Config-sensitive priority set — **Jira excluded** by owner; no further R4 work in this plan.
- **R5:** Success payloads remain tool-specific — unchanged; **`ok: true`** not required (YAGNI).

## Scope Boundaries

- **In scope (done):** Contract module + priority tools + prompt guidance for those tools.
- **Explicitly out of scope:** **Jira** (`lib/ai/tools/jira.ts`) failure shape, Jira-specific prompt copy, Jira tests for `CompanionToolFailure`.
- **Not in scope:** Delegation bridge payloads; local-only tools (`readFile`, `writeFile`, `executeShell`) unless a future plan targets LAN parity; artifact/editor tools.

### Deferred to Separate Tasks

- **Jira normalization:** Only if product priority changes.
- **Local-only tool normalization:** Optional LAN polish.

## Context & Research

### Relevant Code and Patterns

- **Contract:** `lib/ai/companion-tool-result.ts`
- **Consumers:** `lib/ai/tools/briefing.ts`, `calendar.ts`, `get-weather.ts`, `recall-memory.ts`, `save-memory.ts`
- **Prompt:** `lib/ai/companion-prompt.ts` — `buildCompanionToolGuidance`
- **Tests:** `tests/unit/companion-tool-result.test.ts`

### Institutional Learnings

- None under `docs/solutions/` for this topic.

## Key Technical Decisions

- **Jira:** Do not invest in `CompanionToolFailure` for Jira until explicitly requested.
- **Success `ok: true`:** Still out of scope — no consumer.

## Open Questions

### Resolved During Planning

- **Jira migration?** **No** — owner does not care; dropped from scope.

### Deferred to Implementation

- None for this narrowed scope.

## Implementation Units

No remaining implementation units for the **non-Jira** scope — the codebase already matches the origin requirements for the priority tool set. Optional follow-ups (not scheduled here):

- [ ] **Optional:** Add a short JSDoc on `companionToolFailure` pointing future contributors to priority tools as examples — only if it reduces confusion without noise.

## System-Wide Impact

- **Unchanged:** Jira tool results on error remain `{ error: string }` — acceptable under this plan.
- **Unchanged:** Hosted chat behavior for priority tools — already normalized.

## Risks & Dependencies

| Risk | Mitigation |
|------|------------|
| Future contributor assumes Jira must match | This plan documents explicit exclusion; origin brainstorm may be updated separately if desired |

## Documentation / Operational Notes

- None required.

## Sources & References

- **Origin document:** [docs/brainstorms/2026-04-20-companion-in-process-tool-result-shape-requirements.md](../brainstorms/2026-04-20-companion-in-process-tool-result-shape-requirements.md)
- Related code: `lib/ai/companion-tool-result.ts`, `lib/ai/companion-prompt.ts`, `lib/ai/tools/{briefing,calendar,get-weather,recall-memory,save-memory}.ts`
