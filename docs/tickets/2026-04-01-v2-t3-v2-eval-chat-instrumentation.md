# V2-T3 — v2-eval chat instrumentation (`logInteraction` wiring)

**Track:** V2 groundwork — [overview](2026-04-01-v2-groundwork-overview.md)  
**Status:** Done

## Problem

[`lib/v2-eval/interaction-log.ts`](../../lib/v2-eval/interaction-log.ts) exists but is **not called** from the chat path, so `workspace/v2-eval/interactions.jsonl` never populates during real use. v2’s self-evaluation design needs **routing and tool** ground truth from v1.

## Goal

On successful assistant completion (or terminal error path, if cheap), append one JSONL record when `V2_EVAL_LOGGING=true`.

## Required fields (extend `InteractionRecord`)

Add minimally (types + serialization):

- `chatId` (string)
- `promptVariant`: `full` | `slim` | `compact` (mirror route logic)
- `isOllamaLocal` (boolean)
- `localModelClass`: `3b` | `7b` | `null` (or omit when not local)
- `toolsUsed`: string[] (tool names from the turn if available from AI SDK result)
- Keep existing: `timestamp`, `model`, `userMessageLength`, `responseLength`

## Implementation notes

- Hook in [`app/(chat)/api/chat/route.ts`](../../app/(chat)/api/chat/route.ts) where the stream completes (`onFinish` or equivalent on `streamText` / UI stream pipeline)—**must not block** the response path; use fire-and-forget `void logInteraction(...)` with try/catch inside the helper (already silent).
- **Privacy:** document in `workspace/v2-eval/README.md` that JSONL may contain metadata about conversation shape; keep **gitignore** on `interactions.jsonl`.
- Update `.env.example` if new vars are added (prefer none; reuse `V2_EVAL_LOGGING`).

## Acceptance criteria

1. With `V2_EVAL_LOGGING=true`, a completed chat turn produces **one** line in `interactions.jsonl` with the extended fields populated where technically feasible.
2. With flag false/absent, **zero** overhead (early return in helper—already true).
3. `pnpm check` passes; no PII policy regression (lengths only, not full message bodies).

## Key files

- `app/(chat)/api/chat/route.ts`
- `lib/v2-eval/interaction-log.ts`
- `workspace/v2-eval/README.md`
