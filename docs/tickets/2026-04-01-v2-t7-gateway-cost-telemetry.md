# V2-T7 — Gateway cost telemetry (token usage logging stub)

**Track:** V2 groundwork — [overview](2026-04-01-v2-groundwork-overview.md)  
**Status:** Not started

## Problem

v2 plans **monthly inference budgets** split day/night. v1 does not persist **per-turn token or cost** estimates for gateway models in a queryable or JSONL form suitable for calibration.

## Goal

1. **Research** what the Vercel AI SDK / `streamText` exposes on finish (`usage`, `totalTokens`, provider metadata)—document in **`docs/V2_COST_TELEMETRY.md`** with code pointers.
2. **Optional implementation** (same ticket if small): when `V2_EVAL_LOGGING=true` **or** a dedicated `V2_COST_LOGGING=true`, append one JSONL line to `workspace/v2-eval/costs.jsonl` with `{ timestamp, chatId, model, promptTokens?, completionTokens?, totalTokens? }` for **gateway** path only; silent fail; gitignored file.
3. State **explicitly** that local Ollama may omit usage—log `null`s and move on.

## Non-goals

- Billing integration or hard budget enforcement in v1.
- Accurate USD pricing (optional rough table in doc only).

## Acceptance criteria

1. `docs/V2_COST_TELEMETRY.md` exists with “what we can know today” vs “needs provider API.”
2. If code ships: `.gitignore` includes `costs.jsonl`; `.env.example` updated; README note under v2-eval.
3. No regression on local-first default path (no extra network).

## Key files

- `app/(chat)/api/chat/route.ts`
- AI SDK types / `streamText` result shape
- `lib/v2-eval/*`, `.gitignore`, `.env.example`

## Dependency

Can parallel **T3**; easiest if same `onFinish` hook exists.
