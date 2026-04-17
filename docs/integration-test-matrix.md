# Integration test matrix (regression)

Use this when changing auth, tools, cron, or external I/O. Record pass/fail and the **model** used for chat tool rows.

| Integration | Trigger | Auth / trust | Expected on failure |
|-------------|---------|--------------|---------------------|
| **Calendar read** | Chat `listCalendarEvents` | Session + `VIRGIL_CALENDAR_INTEGRATION` + `GOOGLE_CALENDAR_*` | Tool error or empty; no crash |
| **Calendar read** | `GET /api/calendar/status`, `GET /api/calendar/events` | Session cookie (non-guest) | 401 if logged out; JSON error if misconfigured |
| **GitHub issues** | `submitProductOpportunity`, `submitAgentTask` | Gateway model only; PAT in env | Sanitized message; no raw token leak |
| **Reminders** | `setReminder` tool → QStash → `POST /api/reminders` | QStash signature | 401 without signature |
| **Daily digest** | `GET /api/digest` | `Authorization: Bearer $CRON_SECRET` | 401 without secret |
| **Daily digest → Slack** | Same cron, with Slack env set | Webhook URL or bot token + channel | Logged error; DB/email path unaffected |
| **Night review enqueue** | `GET /api/night-review/enqueue` | Bearer `CRON_SECRET` | 401 without secret |
| **Night review run** | QStash → worker route | QStash verify | Reject unsigned |
| **Inbound email → Memory** | Resend webhook → `POST /api/ingest/email` | Svix / `RESEND_WEBHOOK_SECRET` + allowlist | Reject or no-op when disabled |
| **General ingest** | `POST /api/ingest` | Bearer `VIRGIL_INGEST_SECRET` | 401 |
| **OpenClaw delegate** | Chat / bridge | `OPENCLAW_*` reachable | Graceful error in UI or tool result |
| **Digital Self** | `GET /api/digital-self/bridge-health` | Optional service token | Health JSON or unreachable |
| **Local Ollama chat** | `POST /api/chat` with `ollama/…` | N/A | No calendar/GitHub tools on default local branch (by design) |

**Chat tool rows:** Always re-check with both **hosted gateway** and **local** model selections after route or registry changes.

**References:** [operator-integrations-runbook.md](operator-integrations-runbook.md), [docs/security/tool-inventory.md](security/tool-inventory.md).
