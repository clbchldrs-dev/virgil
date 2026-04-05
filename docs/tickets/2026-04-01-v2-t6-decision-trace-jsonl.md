# V2-T6 — Decision trace JSONL (v2 trace shape stub)

**Track:** V2 groundwork — [overview](2026-04-01-v2-groundwork-overview.md)  
**Status:** Done — `lib/v2-eval/trace-log.ts` + `V2_TRACE_LOGGING` route wiring

## Problem

[V2_ARCHITECTURE.md](../V2_ARCHITECTURE.md) § Observability shows a **decision trace** JSON object (`trigger`, `model`, `tier`, `tokens_used`, `tools_invoked`, …). v1 does not emit a comparable structured log for later **routing accuracy** or **night self-eval**.

## Goal

1. Add **`lib/v2-eval/trace-log.ts`** (or extend v2-eval module) with `logDecisionTrace(record)` gated by **`V2_TRACE_LOGGING=true`** (new env var).
2. Append JSONL to **`workspace/v2-eval/traces.jsonl`** (gitignored alongside interactions).
3. Define a **TypeScript type** that mirrors the v2 example fields **as closely as practical**; use `unknown` or optional fields where v1 lacks data today.
4. Call **once per completed chat turn** (same completion hook as T3) with best-effort population—empty arrays OK.

## Non-goals

- Full OpenTelemetry or production observability stack.
- Storing full prompts in traces.

## Acceptance criteria

1. `.env.example` documents `V2_TRACE_LOGGING=false`.
2. `.gitignore` includes `workspace/v2-eval/traces.jsonl`.
3. `workspace/v2-eval/README.md` mentions traces vs interactions.
4. `pnpm check` passes; default off = no behavior change.

## Key files

- `app/(chat)/api/chat/route.ts`
- `lib/v2-eval/*`
- `.env.example`, `.gitignore`

## Dependency

Prefer implementing **after** [T3](2026-04-01-v2-t3-v2-eval-chat-instrumentation.md) so completion-hook wiring is shared or obvious.
