# V2 API contract — chat / streaming / auth (SSOT)

**Status:** Grounding doc for v2 Python backend and Next.js adapter work. **Not** a shipped HTTP spec for production until both sides implement it.

**Related:** [V2_MIGRATION.md](V2_MIGRATION.md) (step 3), [V2_TOOL_MAP.md](V2_TOOL_MAP.md) (companion tools), [V2_ARCHITECTURE.md](V2_ARCHITECTURE.md) § API Server, ticket [T1](tickets/2026-04-01-v2-t1-api-contract-for-python-backend.md), [V1_V2_RISK_AUDIT.md](V1_V2_RISK_AUDIT.md).

**Source of truth for v1 behavior:** `app/(chat)/api/chat/route.ts`, `app/(chat)/api/chat/schema.ts`, `lib/errors.ts`, `app/(auth)/auth.ts`.

---

## 1. Purpose

Describe **what v1 does today** for chat over HTTP so a **headless Python** service (FastAPI per [V2_ARCHITECTURE.md](V2_ARCHITECTURE.md)) and a future **Next.js adapter** can align without reverse-engineering `route.ts`. The **target** section is **normative intent** for parity; exact SSE framing may evolve during implementation.

---

## 2. Current v1 — `POST /api/chat`

### 2.1 Endpoint and method

| Item | Value |
|------|--------|
| **URL** | `POST {origin}/api/chat` (optional `NEXT_PUBLIC_BASE_PATH` prefix) |
| **Success response** | **200** with streaming body (see §2.5) |
| **Client** | Browser / same-origin; uses [`useChat`](https://ai-sdk.dev/)-style integration with `DefaultChatTransport` pointing at `/api/chat` |

### 2.2 Authentication and trust (v1)

- **Mechanism:** **NextAuth** session via **HTTP-only cookie** (`auth()` in route). There is **no** `Authorization: Bearer` on the chat route in v1.
- **Who may call:** Only requests that present a **valid session** for a signed-in user (`guest` or `regular`). Missing session → **401** (`unauthorized:chat`).
- **Chat ownership:** If the chat row exists, `chat.userId` must equal `session.user.id`; else **403** (`forbidden:chat`).

**Security note:** Session cookies are **not** sent cross-origin unless CORS/credentials are explicitly configured. v1 assumes **same-site** browser traffic to the Next app origin.

### 2.3 Additional gates (v1)

- **BotId:** When `BOTID_ENFORCE=1`, unverified bot classification can block the request → **403** (`forbidden:api`). See `lib/security/botid-chat.ts`.
- **IP rate limit:** `checkIpRateLimit` on the request IP (Redis-backed when configured).
- **Hourly message cap:** For non-local models (unless `SKIP_CHAT_MESSAGE_RATE_LIMIT=true`), message count per user in the last hour vs entitlements → **429** (`rate_limit:chat`) when exceeded.
- **Local models:** Before streaming, `assertOllamaReachable()` may run; failures surface as JSON errors (see §2.6).

### 2.4 Request body (v1)

Validated by `postRequestBodySchema` in `app/(chat)/api/chat/schema.ts`:

| Field | Type | Required | Notes |
|--------|------|----------|--------|
| `id` | UUID string | Yes | Chat id (client-generated for new chats). |
| `message` | User message object | Conditional | Present for normal turns: `role: "user"`, `id` UUID, `parts` (text ≤2000 chars and/or image file parts with `url`). |
| `messages` | Array | Conditional | **Tool-approval continuation:** full UI message list with tool parts in `approval-responded` / `output-denied` states. Mutually exclusive flow vs single new `message` per handler logic. |
| `selectedChatModel` | string | Yes | Model id (e.g. `ollama/qwen2.5:3b`); server may fall back to default if not allowed. |
| `selectedVisibilityType` | `"public"` \| `"private"` | Yes | Stored on new chat. |
| `showThinking` | boolean | No | When true, streams reasoning where supported (gateway + Ollama `think`). |

**DELETE `/api/chat?id={uuid}`:** Deletes chat when session user owns it; same session auth as POST.

### 2.5 Streaming format (v1)

- **Implementation:** `createUIMessageStream` + `createUIMessageStreamResponse` from **`ai@6.x`** (see root `package.json`).
- **Transport:** HTTP **200** with a stream consumed by the AI SDK client as a **UI message stream** (not a hand-written newline-delimited JSON API). The wire format is defined by the **Vercel AI SDK** for UI message streaming; treat it as **version-coupled** to `ai@6.0.x` until the adapter pins or translates it.
- **Custom data parts:** The server may write **`data-chat-title`** events (chat title after first user message).
- **Persistence:** `onFinish` writes assistant/user messages to Postgres; optional Mem0 sync; resumable streams may register with Redis when `REDIS_URL` is set.

### 2.6 JSON error responses (v1)

Non-stream failures return `Response.json` from `VirgilError.toResponse()` (`lib/errors.ts`):

```json
{ "code": "type:surface", "message": "…", "cause": "…" }
```

- **`code`:** Pattern `bad_request|unauthorized|forbidden|not_found|rate_limit|offline` + surface (e.g. `unauthorized:chat`, `offline:ollama`).
- **HTTP status:** Maps from error *type* (e.g. `bad_request` → 400, `unauthorized` → 401, `forbidden` → 403, `rate_limit` → 429, `offline` → 503).
- **Database surface:** May return `code: ""` with user-safe `message` while logging server-side (`visibility: log`).

Parse errors on the body → **`bad_request:api`** (400).

---

## 3. Target v2 — Python FastAPI chat (normative intent)

Aligned with [V2_ARCHITECTURE.md](V2_ARCHITECTURE.md) §10–11: headless API on **port 8741** (example), **`POST /chat`**, **Bearer** auth for server-to-server or BFF use.

### 3.1 Request

| Item | Specification |
|------|----------------|
| **Method / path** | `POST /chat` |
| **Auth** | `Authorization: Bearer <API_SECRET>` (or short-lived JWT issued by Next BFF—**decision required** before ship). |
| **CORS** | Allow only configured frontend origin(s) (e.g. `FRONTEND_ORIGIN` / `AUTH_URL` origin). |
| **Body (JSON)** | At minimum: `conversation_id` (UUID), `message` **or** `messages` (same semantic as v1 for tool-approval flows), `selected_chat_model`, `selected_visibility_type`, optional `show_thinking`. Field names may be **snake_case** on Python if the adapter maps from v1’s camelCase. |

### 3.2 Response

| Item | Specification |
|------|----------------|
| **Success** | **200**, `Content-Type` compatible with **SSE** or chunked stream the Next adapter can feed to the chat UI. |
| **Event types (target):** | **Normative names TBD in implementation**; minimally: token/text deltas, tool call lifecycle (start / result / approval if mirrored), terminal **done**, **error**. The Next adapter may **translate** Python SSE ↔ AI SDK UI stream until the client speaks one format natively. |
| **Titles / metadata** | Equivalent of `data-chat-title` or HTTP header follow-up—product decision. |

### 3.3 Errors (target)

- Stable **JSON** errors for pre-stream failures: `code`, `message`, optional `cause`, HTTP status aligned with v1 semantics where possible (401/403/429/503).
- In-stream errors: **terminal event** or SSE `event: error` with safe user message (no stack traces to client).

---

## 4. Security (who may call the future backend)

| Principle | Detail |
|-----------|--------|
| **No secrets in the browser bundle** | `API_SECRET` (or service JWT signing key) lives in **server** env only—Next **Route Handler** or **BFF** attaches credentials when calling Python. |
| **Caller** | Prefer **Next.js server** as the only caller of Python in production (user never holds long-lived API secret). Alternative: signed, short-lived tokens per user—document in ADR before use. |
| **Transport** | TLS in production; Tailscale/CF Tunnel acceptable for home hosting per AGENTS.md patterns. |
| **Tenant** | Python must enforce **user id** on every chat id (same as v1’s `chat.userId` check), not trust client body alone. |

---

## 5. Gap list — Next.js changes to call Python

1. **Auth bridge:** Cookie session → server-side call with **Bearer** or **JWT**; no change to end-user login flow if BFF pattern is used.
2. **URL split:** Client may still POST to **Next** `/api/chat`; Next **proxies** to `https://<mini>:8741/chat` (or tunnel URL)—avoids CORS and secret exposure.
3. **Stream translation:** Map Python SSE (or binary chunks) to **AI SDK 6** UI stream expected by existing hooks, **or** replace client transport with a native fetch reader (larger UI change).
4. **BotId / rate limits:** Either keep enforcement entirely in Next before proxying, or duplicate policy in Python with shared Redis—**one** place should own abuse controls.
5. **Resumable streams / Redis:** Today tied to Next + `resumable-stream`; Python must either support resumption or Next continues to own stream id registration.
6. **Tool approval:** v1 tool states in `messages` payload must remain representable in the contract Python accepts.
7. **Mem0 / Postgres:** Until v2 owns memory, Next may still post-process finished messages; long-term, Python becomes source of truth per V2 architecture.

---

## 6. Examples (redacted)

### 6.1 Success — start of stream (conceptual)

Request (v1 shape today):

```http
POST /api/chat HTTP/1.1
Host: app.example.com
Cookie: authjs.session-token=<redacted>
Content-Type: application/json

{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "message": {
    "id": "6ba7b810-9dad-11d1-80b4-00c04fd430c8",
    "role": "user",
    "parts": [{ "type": "text", "text": "Summarize my last reminder." }]
  },
  "selectedChatModel": "ollama/qwen2.5:3b",
  "selectedVisibilityType": "private",
  "showThinking": false
}
```

Response: **200** + **UI message stream** (binary/text per AI SDK 6). No single JSON body; client consumes events until finish.

Target Python call (via BFF):

```http
POST /chat HTTP/1.1
Host: virgil-mini.example.ts.net:8741
Authorization: Bearer <redacted>
Content-Type: application/json

{
  "conversation_id": "550e8400-e29b-41d4-a716-446655440000",
  "message": { "id": "…", "role": "user", "parts": [{ "type": "text", "text": "Summarize my last reminder." }] },
  "selected_chat_model": "ollama/qwen2.5:3b",
  "selected_visibility_type": "private",
  "user_id": "<derived server-side, not from untrusted client>"
}
```

### 6.2 Model / provider error (JSON, v1-style)

Ollama unreachable (illustrative):

```http
HTTP/1.1 503 Service Unavailable
Content-Type: application/json

{
  "code": "offline:ollama",
  "message": "Ollama is not reachable at http://127.0.0.1:11434. Start Ollama and verify OLLAMA_BASE_URL.",
  "cause": "Ollama is not reachable at http://127.0.0.1:11434"
}
```

Gateway billing / configuration (illustrative):

```http
HTTP/1.1 400 Bad Request
Content-Type: application/json

{
  "code": "bad_request:activate_gateway",
  "message": "AI Gateway requires a valid credit card on file to service requests. …",
  "cause": null
}
```

---

## 7. Revision

Update this document when:

- Chat route auth or body schema changes in v1.
- Python `/chat` shape is implemented (add exact SSE examples).
- Stream format is pinned (e.g. “adapter emits AI SDK UI stream v6”).

Pair major contract changes with a dated entry in [DECISIONS.md](DECISIONS.md).
