# V2 night parity matrix (v1 jobs -> v2 night controller)

**Status:** Groundwork artifact for E10/T5.  
**Related:** [V2_MIGRATION.md](V2_MIGRATION.md), [workspace/night/README.md](../workspace/night/README.md), ticket [T5](tickets/2026-04-01-v2-t5-night-agent-task-v2-parity-matrix.md).

---

## 1) v1 background job matrix

| v1 job | Route(s) | Trigger/auth | Idempotency model | Output | Failure mode | Cost model |
|---|---|---|---|---|---|---|
| Night-review enqueue | `GET /api/night-review/enqueue` | Cron with `Authorization: Bearer $CRON_SECRET` | Uses `windowKey` + shared `runId`; enqueue only, not final dedup | Publishes one QStash message per eligible user to `/api/night-review/run` | 401 on bad bearer; 500 when QStash token/config is missing | 1 QStash message per eligible user/night |
| Night-review worker | `POST /api/night-review/run` | QStash-signed webhook (`upstash-signature`) | Hard dedup via memory check: `metadata.source='night-review'` + `windowKey` + `phase='complete'` (`hasCompletedNightReviewForWindow`) | Writes `Memory` findings and completion markers; writes `NightReviewRun` observability row | 401/400 on signature/payload; 500 on runtime failure | LLM call (Ollama or Gemini depending on `NIGHT_REVIEW_MODEL`) + DB writes |
| Daily digest | `GET /api/digest` | Cron with `Authorization: Bearer $CRON_SECRET` | Soft idempotency by 24h memory window; no dedicated dedup key | Sends summary email via Resend to eligible owners | Per-user send failures logged and loop continues | Resend sends + DB reads |
| Agent-task triage enqueue | `GET /api/agent-tasks/enqueue` | Cron with `Authorization: Bearer $CRON_SECRET` | At-most-one enqueue per trigger call | Publishes QStash message to `/api/agent-tasks/triage` | 401/500 on auth/config issues | 1 QStash publish per enqueue |
| Agent-task triage worker | `POST /api/agent-tasks/triage` | QStash-signed webhook (`upstash-signature`) | Worker-level safeguards in triage logic; no per-window key | Updates `AgentTask` notes/status suggestions | 401/500 on signature/runtime failure | Local Ollama inference + DB writes |

---

## 2) Mapping to v2 night task types

| v1 behavior | v2 task family | Port strategy |
|---|---|---|
| Night-review synthesis findings | Self-evaluation + consolidation inputs | **Merge** into v2 nightly evaluation pipeline; keep window-key completion guard |
| Night-review run observability (`NightReviewRun`) | Decision traces / nightly reports | **Direct port** conceptually (v2 trace/report object) |
| Daily digest email summary | Morning briefing delivery layer | **Merge** (digest content can become downstream renderer/output for briefing) |
| Agent-task triage overnight | Night research / maintenance queue | **Direct port** as queue item type with local-model first policy |
| QStash fanout mechanics | v2 scheduler/queue backend | **v1-only transport**; preserve semantics (signed jobs, delayed fanout), not implementation |

---

## 3) Deferred queue shape (for migration continuity)

A minimal bridge queue item shape that can represent all current jobs:

- `taskType` (`nightReview`, `digest`, `agentTaskTriage`, future `research`)
- `userId`
- `windowKey` (optional but required for nightly idempotency classes)
- `runId` (for grouped result display)
- `trigger` (`cron`, `manual`, `retry`)
- `scheduledAt` / `attempt`

This queue shape is documentation-only in v1; it keeps migration work from inventing new task envelopes per feature.

---

## 4) Idempotency notes to preserve in v2

1. Keep nightly completion dedup keyed by user + local-date window (`windowKey`).
2. Separate enqueue idempotency from worker idempotency (do not assume queue exactly-once delivery).
3. Preserve explicit completion markers (currently in `Memory.metadata.phase = "complete"`).
4. Keep partial-failure tolerance: digest and triage loops continue even when one user/task fails.

---

## 5) Cron and hosting constraints carried from v1

- Vercel Hobby has a practical two-cron budget in current docs (`/api/night-review/enqueue` and `/api/digest`).
- Agent-task triage enqueue is expected to run via self-hosted cron or shared schedule slot.
- QStash-signed worker routes are the current trust boundary for async job execution.

These constraints should be captured in v2 scheduling design, even if v2 transport differs from QStash.
