# V2-T2 — Tool inventory and v2 registry mapping

**Track:** V2 groundwork — [overview](2026-04-01-v2-groundwork-overview.md)  
**Status:** Done — [docs/V2_TOOL_MAP.md](../V2_TOOL_MAP.md); [groundwork overview](2026-04-01-v2-groundwork-overview.md) links artifacts.

## Problem

v2’s Python design uses a **Tool** abstraction (`name`, `description`, `requires_approval`, `allowed_in_night`, JSON schema). v1 tools live as separate files under [`lib/ai/tools/`](../../lib/ai/tools/) with heterogeneous registration in the chat route. There is no single table for migration or safety review.

## Goal

Add **`docs/V2_TOOL_MAP.md`**: a table (or machine-readable appendix JSON) listing **every** personal-mode tool registered today, with columns aligned to v2’s mental model.

## Suggested columns

| Column | Notes |
|--------|--------|
| `v1_tool_name` | As exposed to the model |
| `source_file` | Under `lib/ai/tools/` |
| `gateway_only` / `local` | When omitted on Ollama |
| `mutates_external_state` | Y/N (Jira, shell, files, reminders, …) |
| `v2_requires_approval` | Proposal (v2 default for destructive) |
| `v2_allowed_in_night` | Proposal (read-only / notify vs transition) |
| `v2_notes` | Sandbox limits, parity gaps |

## Scope

- Cover tools registered for **personal companion** path (include artifacts if they are tools in v1).
- Link to v2 tool list in [V2_ARCHITECTURE.md](../V2_ARCHITECTURE.md) § Tool Execution Layer for naming alignment.

## Non-goals

- Rewriting tool implementations.
- Building the Python registry.

## Acceptance criteria

1. `docs/V2_TOOL_MAP.md` exists; every file under `lib/ai/tools/*.ts` that exports a registered tool is accounted for (or explicitly marked “unused / legacy”).
2. At least **three** tools flagged as `v2_requires_approval = yes` with rationale.
3. README or overview links this doc from [2026-04-01-v2-groundwork-overview.md](2026-04-01-v2-groundwork-overview.md) (add link row if not already).

## Key files

- `app/(chat)/api/chat/route.ts` (tool registration)
- `lib/ai/tools/*`
