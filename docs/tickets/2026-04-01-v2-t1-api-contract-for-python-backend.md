# V2-T1 — API contract for Python backend (chat / SSE / auth)

**Track:** V2 groundwork — [overview](2026-04-01-v2-groundwork-overview.md)  
**Status:** Not started

## Problem

[v2 plan](../V2_ARCHITECTURE.md) specifies `POST /chat` with SSE and Bearer auth. v1 today uses Next.js [`app/(chat)/api/chat/route.ts`](../../app/(chat)/api/chat/route.ts) with cookies + Vercel AI SDK streaming. Without a **written contract**, the future adapter layer will drift.

## Goal

Add **`docs/V2_API_CONTRACT.md`** as the SSOT for “what the Next.js app must send/receive when talking to a headless backend,” derived from **current** v1 behavior first, then a short **target** section for Python parity.

## Scope

1. **Current v1** (document as-is): auth mechanism (session cookie vs future Bearer), request body shape (messages, model id, chat id), streaming format (UI message stream / data stream events if relevant), error HTTP codes and JSON bodies users see.
2. **Target v2 adapter** (normative): proposed `POST /chat` JSON body fields (`message` or messages array, `conversation_id`, model override), `Authorization: Bearer`, SSE event types (token deltas, tool-call stubs, done, error), and CORS notes (`FRONTEND_ORIGIN` style).
3. **Gap list**: bullet list of changes required in Next.js to call Python (e.g. token bridge, cookie → API key for that route only).
4. Cross-link [docs/V2_MIGRATION.md](../V2_MIGRATION.md) step 3.

## Non-goals

- Implementing the Python server or Next adapter (documentation only).
- Changing production chat behavior in this ticket.

## Acceptance criteria

1. `docs/V2_API_CONTRACT.md` exists and is linked from [V2_MIGRATION.md](../V2_MIGRATION.md) (one sentence under migration steps).
2. Contract explicitly states **security**: who may call the future backend; no secrets in client bundle.
3. At least one **example** request/response (redacted) for success and one for model error.

## Key files

- `app/(chat)/api/chat/route.ts`
- `lib/auth.ts` (or session helpers used by chat)
- [docs/V2_ARCHITECTURE.md](../V2_ARCHITECTURE.md) § API Server
