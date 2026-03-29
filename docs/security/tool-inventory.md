# Chat tools — risk inventory

LLM-invoked tools live under [`lib/ai/tools/`](../../lib/ai/tools/). Server-side policy must not rely on the model alone — see [security hardening plan](../superpowers/plans/2026-03-29-security-hardening-agents.md) Phase A2.

| Tool | User / data touched | External I/O | When registered | Abuse scenario (1 line) |
|------|----------------------|--------------|-----------------|---------------------------|
| `getWeather` | None persistent | HTTP (Open-Meteo, allowlisted) | Gateway + local (if tools enabled) | Flooding weather API; keep rate limits / allowlist |
| `createDocument` | `Document`, chat | None | Gateway + local (policy) | Spam documents in user’s account |
| `editDocument` | `Document` | None | Same | Overwrite doc content |
| `updateDocument` | `Document` | None | Same | Same |
| `requestSuggestions` | suggestions, chat | None | Same | Noise / suggestion spam |
| `saveMemory` | `Memory` | None | Companion + gateway (policy) | Poison memory store |
| `recallMemory` | `Memory` read | None | Same | Exfil via query (mitigated by user-scoped queries) |
| `setReminder` | reminders, QStash enqueue | QStash | Companion + gateway | Spam reminders / queue abuse |
| `recordIntake` | intake, business | None | Business mode | Fake intake records |
| `escalateToHuman` | escalation, business | None | Business mode | Spam escalations / noise to owner |
| `summarizeOpportunity` | business context | None | Business mode | Mis-summarized opportunities |
| `submitProductOpportunity` | GitHub Issue | GitHub REST | **Gateway only** + env configured | Spam issues — **sanitized errors** to model; consider [future caps](../tickets/future-monetization-product-opportunity-limits.md) |

**High impact (prioritize server-side gates + tests):** `submitProductOpportunity`, `escalateToHuman`, `setReminder`, `saveMemory`, `createDocument` / `editDocument` / `updateDocument`.

**Tool approval (A3):** Tools marked `needsApproval: true` pause for **Allow / Deny** in the chat UI before `execute` runs (`getWeather`, `saveMemory`, `setReminder`, `recordIntake`, `escalateToHuman`, `submitProductOpportunity`). Artifact tools (`createDocument`, `editDocument`, `updateDocument`) and `requestSuggestions` stay auto-run; the user still sees results in the artifact UI. Server-side checks from Phase A2 apply even if the client is bypassed.

**Local Ollama:** Most tools are omitted or reduced; see [`app/(chat)/api/chat/route.ts`](../../app/(chat)/api/chat/route.ts).

---

## Background routes — authentication matrix

| Route | Method | Verifier |
|-------|--------|----------|
| `/api/digest` | GET | `Authorization: Bearer $CRON_SECRET` |
| `/api/night-review/enqueue` | GET | `Authorization: Bearer $CRON_SECRET` |
| `/api/night-review/run` | POST | **QStash** `upstash-signature` + `QSTASH_*` signing keys |
| `/api/reminders` | POST | **QStash** signature (same pattern) |

Self-hosted cron: [AGENTS.md](../../AGENTS.md#scheduled-jobs-on-the-host-no-vercel-cron). No sensitive work without these checks.
