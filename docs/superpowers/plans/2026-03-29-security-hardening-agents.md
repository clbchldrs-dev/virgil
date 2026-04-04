# Security Hardening — Plan (trimmed)

**Goal:** Reduce attack surface from LLM tools, guests, APIs, and background jobs — local-first unchanged.

**Layers:** (1) tool policy, (2) authz on mutating APIs, (3) webhook/cron auth, (4) rate limits, (5) secrets. **Inventory + auth matrix:** [`docs/security/tool-inventory.md`](../../security/tool-inventory.md).

**Superseded by other work (do not duplicate):**

- **Cron / LAN / `AUTH_URL` docs** — done in P4 ([AGENTS.md](../../../AGENTS.md)).
- **Product opportunity error sanitization** — [`sanitizeProductOpportunityToolError`](../../../lib/github/product-opportunity-issue.ts) + [github-product-opportunity.md](../../github-product-opportunity.md).

---

## Phase A — Tools

### A1 — Tool inventory — **Done**

See [`docs/security/tool-inventory.md`](../../security/tool-inventory.md).

### A2 — Server-side policy for high-impact tools — **Done**

- [`lib/ai/tool-policy.ts`](../../../lib/ai/tool-policy.ts) — shared helpers; chat ownership enforced in `saveMemory` / `setReminder`; `submitProductOpportunity` requires `allowed`. Document tools already check `session` vs document `userId` in handlers.
- Tests: [`tests/unit/tool-policy.test.ts`](../../../tests/unit/tool-policy.test.ts).

### A3 — Tool approval UX — **Done**

- **Requires approval (`needsApproval: true`):** `getWeather`, `saveMemory`, `setReminder`, `submitProductOpportunity`.
- **Auto-run:** `createDocument`, `editDocument`, `updateDocument`, `requestSuggestions`, `recallMemory` (results visible in artifact / chat as today).
- **UI:** [`components/chat/message.tsx`](../../../components/chat/message.tsx) — generic tool renderer for approval states on tools not using the weather/artifact/requestSuggestions-specific layouts. Server policy: Phase A2.

### A4 — Prompt injection + logging

- [x] Chat API unhandled/stream errors use `logChatApiException` (no full error object dump in production — `lib/security/log-safe-error.ts`). Prompt copy review remains periodic.

---

## Phase B — API abuse

### B1 — IDOR sweep

- [ ] Checklist: mutating routes under `app/**/api/**` — owner vs `session.user.id`; add 403 tests for highest-risk routes.

### B2 — Rate limits

- [x] Documented fail-open IP limiter behavior in [`lib/ratelimit.ts`](../../../lib/ratelimit.ts) module comment. Optional stricter guest caps unchanged — [ADR](../../DECISIONS.md) only if behavior changes.

### B3 — BotID

- [x] `checkBotId` result wired: production **log** for unverified bots on `POST /api/chat`; optional **`BOTID_ENFORCE=1`** for 403 — [`lib/security/botid-chat.ts`](../../../lib/security/botid-chat.ts), [AGENTS.md](../../../AGENTS.md) env table.

---

## Phase C — Storage

### C1 — Webhook/cron auth — **Documented**

Matrix in [`tool-inventory.md` § Background routes](../../security/tool-inventory.md#background-routes--authentication-matrix). Re-verify handlers when adding routes.

### C2 — Blob upload

- [x] MIME/size limits unchanged; public access documented in [`tool-inventory.md`](../../security/tool-inventory.md#file-uploads-post-apifilesupload); uploads namespaced `userId/uuid-name` in [`upload/route.ts`](../../../app/(chat)/api/files/upload/route.ts).

---

## Phase D — Ops + verification

### D1 — Secrets / deps

- [ ] `pnpm audit` triage; least-privilege tokens in examples.

### D2 — LAN checklist — **Aligned with P4**

Use [beta-lan-gaming-pc.md](../../beta-lan-gaming-pc.md) + [AGENTS.md](../../AGENTS.md#setup-checklist).

### D3 — Gate

- [ ] `pnpm check`, `pnpm build`, targeted tests; manual injection smoke when changing prompts/tools.

---

## Execution

Use **subagent-driven** or **executing-plans** skills for multi-session work; pick one task above per PR unless tightly coupled.
