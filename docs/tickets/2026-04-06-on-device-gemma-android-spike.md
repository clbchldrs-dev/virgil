# Spike: on-device Gemma / Gemini on Android (Pixel) and chat parity

**Status:** research / deferred — not part of the default `POST /api/chat` pipeline.

**Owner scope:** The phone is **not** required to run local/on-device LLM for Virgil; that is an explicit product **non-goal** so network and parity designs stay simple. See [docs/DECISIONS.md](../DECISIONS.md) (2026-04-06) and [docs/TARGET_ARCHITECTURE.md](../TARGET_ARCHITECTURE.md) (mobile browser). This spike remains **optional** exploration if that ever changes.

## Problem

Virgil chat inference runs on the **Next.js server** (`streamText` in `app/(chat)/api/chat/route.ts`). The browser (including Chrome on a **Pixel**) only sends messages and a model id. Running **Gemma or Gemini on the phone** for the same tool-rich thread would require a **client-side** inference path, which is a different product surface than today’s server-only architecture.

## Options (high level)

1. **Chrome Built-in AI / Prompt API** (when available): in-browser model with strict capability limits; unlikely to match full companion tools without a parallel “slim” UX.
2. **WebGPU / WebLLM-style** stacks: heavy bundles, device-specific performance, no tool parity with server tools.
3. **Native shell** (TWA / Capacitor): call Android **AICore** or vendor APIs from Kotlin; still requires a defined contract for how tool calls, memory, and streaming map to the existing chat UI.

## Privacy and product

On-device inference keeps prompts local but **does not** remove the need for server-side auth, Postgres chat history, or tool execution unless the product explicitly supports an **offline** mode with reduced features.

## Relation to shipped mitigations

- **LAN reachability:** See README “Where the app runs vs where Ollama runs.”
- **Gateway rate limits:** Server-side **pre-stream** fallback: gateway → direct Gemini (`GOOGLE_GENERATIVE_AI_API_KEY`) → optional Ollama (`VIRGIL_GATEWAY_FALLBACK_OLLAMA`).
- **virgil/auto:** Server resolves to local Ollama when reachable, else a lightweight gateway model; client sends optional **Network Information**-style hints from `hooks/use-active-chat.tsx`.

## Mid-stream rate limits (follow-up)

If the AI Gateway returns **429 or quota errors after streaming has started**, today’s `try/catch` around `mergeGatewayStream()` may **not** run, because failures surface asynchronously on the stream. A follow-up would:

- attach **`onError` / completion handlers** to the UI message stream,
- define UX for **partial assistant text** plus a **single** retried continuation or a visible “retry with …” notice,
- reuse the same tier order (Gemini direct → Ollama) only where provider contracts allow safe retry.

Track as a separate ticket when mid-stream failures become a measured problem.
