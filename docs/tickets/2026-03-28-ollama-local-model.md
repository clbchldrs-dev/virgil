# Ollama local model — agent work tickets

**Problem (user-reported):** Chat works with gateway models (e.g. Kimi, GPT OSS) but fails when the UI selects the local **Ollama** model (`ollama/qwen2.5:3b` in `lib/ai/models.ts`).

**Integration points (read first):**

- `lib/ai/providers.ts` — `ollama()` from `ollama-ai-provider`, `isLocalModel()`, `getLanguageModel` / `getTitleModel`
- `app/(chat)/api/chat/route.ts` — `streamText` with many tools + `providerOptions.gateway` / `openai` (may be irrelevant or harmful for Ollama)
- `lib/ai/models.ts` — `localModelCapabilities` marks local Qwen as `tools: true`

**Suggested parallelization:** Tickets **1** and **4** can start immediately. **2** and **3** can overlap after a quick read of **1**’s findings; **5** depends on chosen fixes.

---

## Ticket OLLAMA-1 — Connectivity & configuration

**Owner:** Agent A  
**Goal:** Prove or rule out “cannot reach Ollama from the Next.js server.”

**Checklist:**

- [ ] Document default Ollama URL for `ollama-ai-provider` (env vars: e.g. `OLLAMA_BASE_URL` / host — verify in package source or upstream docs).
- [ ] Confirm `pnpm dev` process can `fetch` Ollama’s tags/list endpoint from the same host the provider uses.
- [ ] Add **AGENTS.md** subsection: install Ollama, `ollama pull` for the exact model id in `chatModels`, firewall / LAN, and “Next runs server-side — localhost is the dev machine.”
- [ ] If misconfiguration is common, add optional startup log (one line, no secrets): “Ollama target = …” when `isLocalModel` is selected (or document manual `curl` steps only — prefer minimal code).

**Acceptance criteria:** Written repro + doc update; either a confirmed connectivity failure mode with fix, or connectivity ruled out with evidence (curl/log).

**Files:** `AGENTS.md`, possibly `.env.local` comments, optionally a tiny `lib/ai/ollama-config.ts` if you centralize base URL.

**Out of scope:** Changing tool sets (that’s ticket 2).

---

## Ticket OLLAMA-2 — Tools / `streamText` compatibility for small local models

**Owner:** Agent B  
**Goal:** Prove or rule out “Ollama model chokes on tool calling or multi-step `streamText`.”

**Facts from code:**

- Local model uses `capabilities.tools === true` from `localModelCapabilities` in `lib/ai/models.ts`, so the chat route may register **full** tool sets (base + front-desk or companion tools) like gateway models.
- Small instruct models often return invalid tool JSON or error when many tools are registered.

**Checklist:**

- [ ] Reproduce with **same** user/session as gateway success; capture **server** error (stack or provider message) for the failing request.
- [ ] Experiment: for `isLocalModel(chatModel)`, force `experimental_activeTools: []` and/or omit `tools` (text-only path) — does chat succeed?
- [ ] If text-only works: design minimal policy — e.g. `localModelCapabilities.tools = false` and/or dedicated branch in `route.ts` for “local = no tools” or “subset (e.g. getWeather only).”
- [ ] Ensure **owner** vs **visitor** modes both behave; document tradeoffs (local model = no intake/memory tools).

**Acceptance criteria:** Clear matrix: which tool configurations work; PR with intentional behavior + short comment in `route.ts` or `models.ts`.

**Files:** `app/(chat)/api/chat/route.ts`, `lib/ai/models.ts`, possibly prompts if we must tell the model not to use tools.

**Depends on:** None strictly; use findings from OLLAMA-1 if connectivity was broken first.

---

## Ticket OLLAMA-3 — Provider / AI SDK streaming & `providerOptions`

**Owner:** Agent C  
**Goal:** Prove or rule out “ollama-ai-provider + `ai@6` / `streamText` / UI stream merge incompatibility.”

**Checklist:**

- [ ] Inspect whether `providerOptions.gateway` / `openai` in `commonStreamArgs` should be **omitted** when `isLocalModel(chatModel)` (currently spread from `modelConfig` may be harmless no-ops or may confuse).
- [ ] Compare minimal `streamText({ model: ollama('qwen2.5:3b'), messages, system })` script (tsx one-off) vs full chat route — isolate failure inside or outside route.
- [ ] Check `ollama-ai-provider` version against AI SDK 6 release notes; note any required upgrades.

**Acceptance criteria:** Short doc in ticket comment or `docs/tickets/` appendix: root cause if found, or “provider path clean; failure is tools/connectivity.”

**Files:** `lib/ai/providers.ts`, `package.json`, possibly a **throwaway** `scripts/ollama-smoke.ts` (delete before merge or keep under `scripts/` if useful).

**Depends on:** Optional overlap with OLLAMA-2 (smoke script without tools).

---

## Ticket OLLAMA-4 — User-visible errors & support signals

**Owner:** Agent D  
**Goal:** Stop hiding Ollama failures behind generic “Oops, an error occurred!”

**Checklist:**

- [ ] Map provider errors (ECONNREFUSED, 404 model not found, parse errors) to **safe** user messages (no stack traces in UI).
- [ ] Ensure **server logs** include enough to debug (model id, high-level error name); no secrets.
- [ ] Optional: toast hint “Is Ollama running? Try `ollama list`.” when message matches connection errors.

**Acceptance criteria:** Repro: stop Ollama → user sees specific guidance; start Ollama → chat works (if other tickets fixed underlying issue).

**Files:** `app/(chat)/api/chat/route.ts` (`onError` / outer `catch`), possibly `hooks/use-active-chat.tsx` for client-side classification.

**Depends on:** None; can land independently.

---

## Ticket OLLAMA-5 — Regression check (optional)

**Owner:** Agent E or same as 2  
**Goal:** Prevent gateway regressions while fixing Ollama.

**Checklist:**

- [ ] Add **manual** QA checklist to `AGENTS.md`: gateway model + Ollama model smoke.
- [ ] If feasible: Playwright test gated on `process.env.OLLAMA_E2E=1` that skips by default (CI may not have Ollama).

**Acceptance criteria:** Documented steps; optional skipped-by-default test.

---

## Dependency graph (for coordinators)

```
OLLAMA-1 (connectivity)     OLLAMA-4 (errors)
       \                   /
        OLLAMA-2 (tools)  ——— OLLAMA-3 (provider/stream)
                    \
                  OLLAMA-5 (QA)
```

## Handoff line for each agent

Paste in task description:

> Read `docs/tickets/2026-03-28-ollama-local-model.md` ticket **OLLAMA-N**. Touch only the files listed. Run `pnpm check` and `pnpm build` before opening PR. Do not change gateway behavior without explicit test notes.
