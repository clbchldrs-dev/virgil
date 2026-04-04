# V2 tool map — v1 inventory → v2 registry model

**Status:** Migration inventory. v2 Python shape is described in [V2_ARCHITECTURE.md](V2_ARCHITECTURE.md) § Tool Execution Layer (`name`, `description`, `requires_approval`, `allowed_in_night`, JSON schema).

**Related:** [V2_API_CONTRACT.md](V2_API_CONTRACT.md), ticket [T2](tickets/2026-04-01-v2-t2-tool-inventory-and-v2-mapping.md), registration in `app/(chat)/api/chat/route.ts`.

---

## 1. How tools are registered in v1

| Path | Tools |
|------|--------|
| **Local Ollama** (`isOllamaLocal`) | Only OpenClaw tools **if** `OPENCLAW_*` is configured: `delegateTask`, `approveOpenClawIntent`. Otherwise **no** tools are passed to `streamText`. |
| **Gateway (hosted) models** | `baseTools` + `companionTools` + optional `submitProductOpportunity` / `submitAgentTask` + optional OpenClaw block. `experimental_activeTools` may be empty when the model is “reasoning” without tool support. |
| **Companion subset on Vercel** | `getCompanionTools()` omits `readFile`, `writeFile`, `executeShell`, `getBriefing` when `VERCEL` is set — only Jira + calendar universal tools remain in the companion object. |

---

## 2. Inventory (every `lib/ai/tools/*.ts` tool)

`companion.ts` is an **aggregator** (no tool export); all other `.ts` files below export at least one tool used in the matrix.

| v1_tool_name | source_file | v1_registration | mutates_external_state | v2_requires_approval (proposal) | v2_allowed_in_night (proposal) | v2_notes |
|--------------|-------------|-----------------|-------------------------|----------------------------------|-----------------------------------|----------|
| `getWeather` | `get-weather.ts` | Gateway only | N | No | Yes | Read-only forecast; safe for nudges. |
| `createDocument` | `create-document.ts` | Gateway only | Y (DB + Blob) | **Yes** | No | Creates artifact-backed document; v2 `file_write`-class gate. |
| `editDocument` | `edit-document.ts` | Gateway only | Y | **Yes** | No | Mutates document content stream. |
| `updateDocument` | `update-document.ts` | Gateway only | Y | **Yes** | No | Persists document updates. |
| `requestSuggestions` | `request-suggestions.ts` | Gateway only | Y (suggestion rows) | **Yes** | No | Writes suggestion state tied to document. |
| `saveMemory` | `save-memory.ts` | Gateway only | Y (Memory rows) | **Yes** (v1 `needsApproval: true`) | No | UI approval step before persist; align v2 with same gate unless policy changes. |
| `recallMemory` | `recall-memory.ts` | Gateway only | N | No | Yes | Read/search. |
| `setReminder` | `set-reminder.ts` | Gateway only | Y (QStash / schedules) | **Yes** (v1 `needsApproval: true`) | No | Outbound notifications; v2 align with reminder policy. |
| `getJiraIssue` | `jira.ts` | Gateway (always in companion when registered) | N | No | Yes | Read Jira. |
| `searchJiraIssues` | `jira.ts` | Gateway | N | No | Yes | JQL read. |
| `updateJiraIssue` | `jira.ts` | Gateway | Y | **Yes** — mutates remote issue (summary/comment) | No | Maps to v2 `jira_comment` / transition-style external write. |
| `listCalendarEvents` | `calendar.ts` | Gateway | N | No | Yes | Read-only if calendar API is read. |
| `readFile` | `filesystem.ts` | Gateway, **not** on Vercel | N | No | Yes | `ALLOWED_FILE_ROOTS` env gates paths. |
| `writeFile` | `filesystem.ts` | Gateway, **not** on Vercel | Y | **Yes** — overwrites/creates paths | No | Same root validation; v2 `file_write` with allowlist. |
| `executeShell` | `shell.ts` | Gateway, **not** on Vercel | Y | **Yes** — arbitrary `exec` with pattern blocklist only | No | v2 should use allowlisted commands or sandbox; see V2_ARCH `shell`. |
| `getBriefing` | `briefing.ts` | Gateway, **not** on Vercel | N | No | Yes | Aggregates context for briefing-style answers. |
| `submitProductOpportunity` | `submit-product-opportunity.ts` | Gateway only; **off** for local models | Y (GitHub Issue) | **Yes** — public issue surface | No | Tool description asks user consent; keep explicit approval in v2. |
| `submitAgentTask` | `submit-agent-task.ts` | Gateway only; **off** for local models | Y (DB + optional GitHub) | **Yes** | No | Queues work for humans/agents; gateway-only today. |
| `delegateTask` | `delegate-to-openclaw.ts` | Gateway **and** local Ollama when OpenClaw configured | Y (LAN gateway) | **Yes** — `delegationNeedsConfirmation` queues `PendingIntent` | No* | *OpenClaw `allowed_in_night` is product-specific; default deny until policy exists. |
| `approveOpenClawIntent` | `approve-openclaw-intent.ts` | Same as `delegateTask` | Y (sends queued intent) | N (this **is** the approval step) | No | v2 “approve pending execution” analogue. |

---

## 3. At least three tools: `v2_requires_approval = yes` (rationale)

1. **`executeShell`** — Runs `child_process.exec` with only regex blocklists. Any mistake or jailbreak can touch the host filesystem or network; v2 should treat shell like [V2_ARCHITECTURE.md](V2_ARCHITECTURE.md) **shell** tool: allowlist + approval for anything beyond read-only diagnostics.

2. **`writeFile`** — Creates/overwrites files under optional `ALLOWED_FILE_ROOTS`; still destructive within those roots. Matches v2 **`file_write`** to a designated output directory with explicit approval for non-idempotent writes.

3. **`updateJiraIssue`** — PUT/POST to Jira changes customer-visible records; aligns with v2 **`jira_transition`** / comment tools that require approval by default.

4. **`delegateTask` (OpenClaw)** — Hands work to an external gateway; sensitive intents require owner confirmation before send (`PendingIntent` + UI). A future **Agent Zero** bridge should reuse the same **queue + approve** pattern.

*(Additional candidates: `createDocument`, `editDocument`, `updateDocument`, `requestSuggestions`, `setReminder`, `submitProductOpportunity`, `submitAgentTask` — all proposed **Yes** in the table where they mutate external or durable state.)*

---

## 4. Alignment with v2 architecture tool names

[v2 § Phase 1 tools](V2_ARCHITECTURE.md) lists: `jira_comment`, `jira_transition`, `notify`, `file_write`, `shell`, `web_fetch`.

| v2 (planned) | v1 analogue today |
|--------------|-------------------|
| `jira_comment` | Part of `updateJiraIssue` (comment branch). |
| `jira_transition` | Not a separate v1 tool — only summary/comment updates. **Gap:** transition/status change not exposed. |
| `notify` | No single v1 tool; reminders via `setReminder` (QStash). |
| `file_write` | `writeFile` (filesystem) + artifact writes inside document tools. |
| `shell` | `executeShell`. |
| `web_fetch` | **Not** a v1 chat tool today (fetch exists elsewhere in app if at all). **Gap** for parity. |

---

## 5. Files under `lib/ai/tools/` — coverage

| File | Role |
|------|------|
| `approve-openclaw-intent.ts` | Tool: `approveOpenClawIntent` |
| `briefing.ts` | Tool: `getBriefing` |
| `calendar.ts` | Tool: `listCalendarEvents` |
| `companion.ts` | **Not a tool** — exports `getCompanionTools` / `getCompanionToolNames` |
| `create-document.ts` | Tool: `createDocument` |
| `delegate-to-openclaw.ts` | Tool: `delegateTask` |
| `edit-document.ts` | Tool: `editDocument` |
| `filesystem.ts` | Tools: `readFile`, `writeFile` |
| `get-weather.ts` | Tool: `getWeather` |
| `jira.ts` | Tools: `getJiraIssue`, `searchJiraIssues`, `updateJiraIssue` |
| `recall-memory.ts` | Tool: `recallMemory` |
| `request-suggestions.ts` | Tool: `requestSuggestions` |
| `save-memory.ts` | Tool: `saveMemory` |
| `set-reminder.ts` | Tool: `setReminder` |
| `shell.ts` | Tool: `executeShell` |
| `submit-agent-task.ts` | Tool: `submitAgentTask` |
| `submit-product-opportunity.ts` | Tool: `submitProductOpportunity` |
| `update-document.ts` | Tool: `updateDocument` |

**Unused / legacy:** None in this directory; registration is centralized in the chat route.

---

## 6. Revision

Update when:

- New tools are added to `app/(chat)/api/chat/route.ts`.
- OpenClaw is superseded by an Agent Zero bridge ([TARGET_ARCHITECTURE.md](TARGET_ARCHITECTURE.md)).
- Vercel vs self-host companion rules change.

Pair major changes with [DECISIONS.md](DECISIONS.md) if behavior or safety class changes.
