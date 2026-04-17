# Chat tools — risk inventory

LLM-invoked tools live under [`lib/ai/tools/`](../../lib/ai/tools/). Server-side policy must not rely on the model alone — see [security hardening plan](../superpowers/plans/2026-03-29-security-hardening-agents.md) Phase A2.

| Tool | User / data touched | External I/O | When registered | Abuse scenario (1 line) |
|------|----------------------|--------------|-----------------|---------------------------|
| `getWeather` | None persistent | HTTP (Open-Meteo, allowlisted) | Gateway when tools enabled | Flooding weather API; keep rate limits / allowlist |
| `createDocument` | `Document`, chat | None | Gateway when tools enabled | Spam documents in user’s account |
| `editDocument` | `Document` | None | Same | Overwrite doc content |
| `updateDocument` | `Document` | None | Same | Same |
| `requestSuggestions` | suggestions, chat | None | Same | Noise / suggestion spam |
| `saveMemory` | `Memory` | None | Companion + gateway (policy) | Poison memory store |
| `recallMemory` | `Memory` read | None | Same | Exfil via query (mitigated by user-scoped queries) |
| `setReminder` | reminders, QStash enqueue | QStash | Companion + gateway | Spam reminders / queue abuse |
| `submitAgentTask` | `AgentTask`, optional GitHub | GitHub REST when configured | **Gateway only** | Spam tasks / issues |
| `submitProductOpportunity` | GitHub Issue | GitHub REST | **Gateway only** + env configured | Spam issues — **sanitized errors** to model; consider [future caps](../tickets/future-monetization-product-opportunity-limits.md) |

**High impact (prioritize server-side gates + tests):** `submitProductOpportunity`, `submitAgentTask`, `setReminder`, `saveMemory`, `createDocument` / `editDocument` / `updateDocument`.

**Tool approval (A3):** Tools marked `needsApproval: true` pause for **Allow / Deny** in the chat UI before `execute` runs (`getWeather`, `setReminder`, `submitProductOpportunity`, `submitAgentTask` when registered). `saveMemory` / `recallMemory` are user-scoped DB reads/writes and run without that gate. Artifact tools (`createDocument`, `editDocument`, `updateDocument`) and `requestSuggestions` stay auto-run; the user still sees results in the artifact UI. Server-side checks from Phase A2 apply even if the client is bypassed.

**Local Ollama:** Tools are not attached on the chat route; see [`app/(chat)/api/chat/route.ts`](../../app/(chat)/api/chat/route.ts).

**Cron: daily digest → Slack:** Not an LLM tool. `GET /api/digest` optionally posts the same plaintext as the digest email to Slack when `VIRGIL_SLACK_CHECKIN_WEBHOOK_URL` or bot token + channel env is set ([`app/api/digest/route.ts`](../../app/api/digest/route.ts)). Abuse scenario: leaked webhook URL or token → channel spam; keep secrets server-only and rotate if exposed.

---

## Background routes — authentication matrix

| Route | Method | Verifier |
|-------|--------|----------|
| `/api/digest` | GET | `Authorization: Bearer $CRON_SECRET` |
| `/api/night-review/enqueue` | GET | `Authorization: Bearer $CRON_SECRET` |
| `/api/night-review/run` | POST | **QStash** `upstash-signature` + `QSTASH_*` signing keys |
| `/api/reminders` | POST | **QStash** signature (same pattern) |
| `/api/agent-tasks/enqueue` | GET | `Authorization: Bearer $CRON_SECRET` + `AGENT_TASK_TRIAGE_ENABLED=1` |
| `/api/ingest` | POST | `Authorization: Bearer $VIRGIL_INGEST_SECRET` + `VIRGIL_INGEST_ENABLED=1` |
| `/api/journal/parse` | GET, POST | `Authorization: Bearer $CRON_SECRET` + `VIRGIL_JOURNAL_FILE_PARSE=1` (POST body variant for journal text on serverless) |
| `/api/ingest/email` | POST | **Svix** webhook headers + `RESEND_WEBHOOK_SECRET` + `VIRGIL_EMAIL_INGEST_ENABLED=1` |
| `/api/openclaw/pending` | GET, PATCH | Session auth (`auth()`), user-scoped DB filters; no cron/QStash secret |
| `/api/sophon/daily` | GET, POST | Session auth; `GET` builds brief from user `SophonTask` rows; `POST` upserts `SophonDailyReview` for signed-in user |
| `/api/sophon/tasks` | POST | Session auth; inserts `SophonTask` for signed-in user |

Self-hosted cron: [AGENTS.md](../../AGENTS.md#scheduled-jobs-on-the-host-no-vercel-cron). No sensitive work without these checks.

**Session-authenticated ingress:** `POST /api/ingest/share` (PWA Web Share Target) requires a signed-in **non-guest** user; writes `Memory` for that user only.

---

## File uploads (`POST` `/api/files/upload`)

Authenticated users only; MIME (JPEG/PNG) and size limits are validated in [`app/(chat)/api/files/upload/route.ts`](../../app/(chat)/api/files/upload/route.ts). Blobs use **`access: "public"`** so image URLs work in the chat UI without signed URLs; object keys are scoped under **`userId/uuid-filename`** to avoid a single flat namespace. Treat uploaded images as **sensitive** if chats contain private content — URLs are unguessable but shareable if leaked.

---

## IDOR prevention (mutating / sensitive reads)

Shared ownership checks for high-traffic routes live in [`lib/security/idor.ts`](../../lib/security/idor.ts) with unit tests in [`tests/unit/idor.test.ts`](../../tests/unit/idor.test.ts). Other routes enforce ownership in **query** `WHERE` clauses (e.g. `memory.userId`, `agentTask.userId`) — see [`lib/db/query-modules/`](../../lib/db/query-modules/).

| Area | Mechanism |
|------|-----------|
| Vote (`/api/vote`) | `auth()` then `getChatById`; `chatVoteAccessVirgilError` — chat must exist and `chat.userId === session.user.id` |
| Suggestions (`/api/suggestions`) | Auth before DB read; `suggestionWrongOwnerVirgilError` on first row |
| Document (`/api/document`) | `auth()` then fetch; `documentRowAccessVirgilError` for GET/DELETE; POST checks owner before update |
| Chat (`/api/chat`) | `getChatById` then `userId` match; DELETE same |
| Memory PATCH (`proposals`, `night-review`) | `WHERE memory.id AND memory.userId` in query layer |
| Agent tasks PATCH | `UPDATE … WHERE id AND userId` |
| Jobs / background jobs | `userId` in query or `get*ForUser` helpers |

---

## npm supply chain (axios incident and audits)

**axios (March 2026 npm compromise):** Malicious releases were **1.14.1** and **0.30.4** (malicious dependency **plain-crypto-js@4.2.1**). Virgil has **no direct** `axios` dependency; it is pulled in by **`mem0ai`**. Root [`package.json`](../../package.json) sets **`pnpm.overrides.axios`** to **1.14.0** (vendor-recommended safe 1.x release below **1.14.1**) so a wider transitive range cannot resolve the compromised version.

**Verification:** `pnpm why axios`; search all `pnpm-lock.yaml` files for `axios@1.14.1`, `axios@0.30.4`, and `plain-crypto-js`.

**`pnpm audit`:** Exits non-zero for many trees — treat **`pnpm-lock.yaml`** as ground truth for exact installed versions. Recent triage surfaced (non-exhaustive): Playwright browser install TLS verification (dev dependency), `ultracite` → `glob` → `minimatch` / `@isaacs/brace-expansion`, and **undici** (transitive). Follow [GitHub Security Advisories](https://github.com/advisories) and upgrade upstream when practical.

**CI:** Lint workflow uses **`pnpm install --frozen-lockfile`** so CI cannot drift from the committed lockfile without an explicit lockfile update. Playwright workflow already used the same flag.

**If you ran `pnpm install` / `npm install` during the exposure window:** Rotate credentials for that machine, review IOCs in [Microsoft’s mitigation post](https://www.microsoft.com/en-us/security/blog/2026/04/01/mitigating-the-axios-npm-supply-chain-compromise/) and [axios issue #10636](https://github.com/axios/axios/issues/10636), then reinstall from a verified lockfile.
