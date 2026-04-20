---
date: 2026-04-20
topic: companion-in-process-tool-result-shape
---

# Normalized failure payloads for in-process companion tools

## Problem Frame

**Who:** Operators and the hosted companion model when **in-process** tools (calendar, weather, briefing, memory, etc.) hit misconfiguration, upstream errors, or missing integrations.

**What:** Failures were returned in **inconsistent shapes** (strings, ad-hoc fields), while **delegation** tools already expose a stable pattern (`error` / `errorCode` / `retryable` / `message` / optional `hint`). That mismatch makes prompt guidance harder and increases the risk the model **hallucinates success** or misreads recoverability.

**Why it matters:** Aligns with **R5 (degraded honesty)** from the chief-of-staff narrative — when something is off, the model should **ground** in structured tool output, not improvise.

## Requirements

**Failure contract**

- R1. **Normalized failure object** — In-process companion tools that report failure return **`ok: false`** plus **`error`** (short snake_case category), **`errorCode`** (stable, branchable), **`retryable`**, **`message`** (human-facing), and optional **`hint`** (operator-oriented, e.g. env names).
- R2. **Single constructor** — Failures are built through one helper (`companionToolFailure` in `lib/ai/companion-tool-result.ts`) so fields stay consistent and prompts can rely on them.
- R3. **Prompt alignment** — The companion system prompt tells the model that when tools return **`ok: false`** with **`errorCode`** / **`retryable`**, those fields are **authoritative**, in the same spirit as the delegation tool-results block (and names example families: calendar, weather, recallMemory, saveMemory, getBriefing).

**Scope of adoption**

- R4. **Config-sensitive tools first** — Tools that depend on env or OAuth (briefing, calendar, weather, recall/save memory as applicable) return the normalized shape on failure paths already wired in code. **Jira is out of scope** for this contract unless product priority changes (see Scope Boundaries).
- R5. **Success payloads** — Remain **tool-specific**; this work does not require a unified success schema unless a future brainstorm explicitly needs it.

## Success Criteria

- A reviewer can open `lib/ai/companion-tool-result.ts` and describe the **one** failure contract without caveats.
- The system prompt does not contradict R1–R3 (no guidance that treats string-only errors as equal to structured failures for the listed tools).
- New failure paths for in-process tools default to the helper rather than ad-hoc objects.

## Scope Boundaries

- **Not** changing delegation wire formats or Hermes/OpenClaw payloads — only **in-process** hosted companion tools and prompts.
- **Not** requiring every tool in the repo to migrate immediately; **R4** names the priority set from the current implementation push.
- **Not** normalizing **Jira** tool failures (`lib/ai/tools/jira.ts`) — explicit **non-goal** for now; legacy `{ error: string }` on catch is acceptable.
- **Not** defining HTTP API schemas for external clients unless a separate product decision expands tool results beyond the model.

## Key Decisions

- **Parity target:** Match the **additive** delegation pattern (stable codes + retryable + hint) so one mental model covers hosted and delegated tools in prompts.
- **Jira excluded (2026-04-20):** Jira tools remain on legacy `{ error: string }` **by choice** — not a backlog item for this requirements set.

## Dependencies / Assumptions

- Relies on existing tool registration in the hosted chat path; no new infrastructure.
- **Verified in repo:** `companionToolFailure` exists; briefing, calendar, get-weather, recall-memory, save-memory import it (see grep). Jira does **not** use it — **intentional** (see Key Decisions).

## Outstanding Questions

### Resolve Before Planning

_(None.)_

### Deferred to Planning

- [Affects R5][Technical] Whether any **success** paths should gain a minimal shared field (e.g. `ok: true`) for symmetry — only if a consumer needs it.

### Closed (not planning)

- **Jira + `CompanionToolFailure`:** Explicitly **won’t do** unless product reprioritizes; no open question.

## Next Steps

- **`/ce:plan`** — only if scope expands (e.g. additional in-process tools, or a consumer for success envelopes).
- **`/ce:work`** — for small follow-ups aligned with **R4** priority tools; not for Jira unless priorities change.

## Related plan

- `docs/plans/2026-04-20-002-refactor-companion-in-process-tool-failure-parity-plan.md` — non-Jira scope marked **completed**; Jira excluded by owner decision.

## Alternatives considered

- **String-only errors everywhere** — Rejected for config-heavy tools; stable **`errorCode`** is needed for prompt branching and future UI.
- **Unified success+failure envelope for all tools** — Deferred as YAGNI until a consumer requires it.
