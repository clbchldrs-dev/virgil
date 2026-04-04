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

**Tool approval (A3):** Tools marked `needsApproval: true` pause for **Allow / Deny** in the chat UI before `execute` runs (`getWeather`, `saveMemory`, `setReminder`, `submitProductOpportunity`). Artifact tools (`createDocument`, `editDocument`, `updateDocument`) and `requestSuggestions` stay auto-run; the user still sees results in the artifact UI. Server-side checks from Phase A2 apply even if the client is bypassed.

**Local Ollama:** Tools are not attached on the chat route; see [`app/(chat)/api/chat/route.ts`](../../app/(chat)/api/chat/route.ts).

---

## Background routes — authentication matrix

| Route | Method | Verifier |
|-------|--------|----------|
| `/api/digest` | GET | `Authorization: Bearer $CRON_SECRET` |
| `/api/night-review/enqueue` | GET | `Authorization: Bearer $CRON_SECRET` |
| `/api/night-review/run` | POST | **QStash** `upstash-signature` + `QSTASH_*` signing keys |
| `/api/reminders` | POST | **QStash** signature (same pattern) |

Self-hosted cron: [AGENTS.md](../../AGENTS.md#scheduled-jobs-on-the-host-no-vercel-cron). No sensitive work without these checks.

---

## File uploads (`POST` `/api/files/upload`)

Authenticated users only; MIME (JPEG/PNG) and size limits are validated in [`app/(chat)/api/files/upload/route.ts`](../../app/(chat)/api/files/upload/route.ts). Blobs use **`access: "public"`** so image URLs work in the chat UI without signed URLs; object keys are scoped under **`userId/uuid-filename`** to avoid a single flat namespace. Treat uploaded images as **sensitive** if chats contain private content — URLs are unguessable but shareable if leaked.
