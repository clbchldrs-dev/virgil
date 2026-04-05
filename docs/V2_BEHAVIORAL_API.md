# V2 behavioral HTTP API (companion to chat contract)

**Status:** SPEC — Not implemented. Normative intent for the v2 Python FastAPI layer when behavioral features ship.

**Related:** [V2_API_CONTRACT.md](V2_API_CONTRACT.md) (chat, SSE, auth parity with v1). This document covers **goals**, **projects**, and **schedule** only — keep the chat contract document focused on `POST /chat` and streaming.

**Domain SSOT:** [V2_BEHAVIORAL_SPECS.md](V2_BEHAVIORAL_SPECS.md).

**Auth:** Expected to match v2 Phase 1 pattern from [V2_ARCHITECTURE.md](V2_ARCHITECTURE.md) — e.g. `Authorization: Bearer {API_SECRET}` for server-to-server calls from the Next.js adapter. Final scheme TBD when the Python backend lands.

---

## Goals and habits

| Method | Path | Purpose |
|--------|------|---------|
| `POST` | `/api/goals` | Create goal |
| `GET` | `/api/goals` | List active goals |
| `GET` | `/api/goals/:id/status` | Current streak, trend, alert level |
| `POST` | `/api/goals/:id/entries` | Log completion |
| `GET` | `/api/goals/:id/entries` | History (support `from` / `to` date range query params) |
| `POST` | `/api/goals/check-in` | Batch update from daily check-in |
| `GET` | `/api/goals/briefing-summary` | Formatted summary for morning briefing |

---

## Projects

| Method | Path | Purpose |
|--------|------|---------|
| `POST` | `/api/projects` | Create project |
| `GET` | `/api/projects` | List projects (filter query params: `status`, `priority`) |
| `PATCH` | `/api/projects/:id` | Update status, blocker fields, priority |
| `POST` | `/api/projects/:id/actions` | Add next action |
| `PATCH` | `/api/projects/:id/actions/:aid` | Complete or skip action |
| `POST` | `/api/projects/:id/notes` | Add note |
| `GET` | `/api/projects/:id/timeline` | Full history (actions + notes, chronological) |
| `GET` | `/api/projects/stale` | All stale projects with reasons |
| `GET` | `/api/projects/briefing-summary` | Formatted summary for morning briefing |

---

## Schedule

| Method | Path | Purpose |
|--------|------|---------|
| `POST` | `/api/schedule/generate` | Trigger proposal generation for next week |
| `GET` | `/api/schedule/proposal` | Get current pending proposal |
| `PATCH` | `/api/schedule/proposal` | Modify proposal (move/remove/add slots) |
| `POST` | `/api/schedule/proposal/approve` | Push approved schedule to Google Calendar |
| `GET` | `/api/schedule/current-week` | This week's plan with completion status |
| `POST` | `/api/schedule/adjust` | Mid-week change request |

---

## Revision

Update this document when:

- Behavioral routes are implemented on the Python backend (add request/response JSON shapes).
- Path prefix changes (e.g. all routes under `/v1/behavior/...` instead of `/api/...`).
- Auth model diverges from Bearer `API_SECRET` (document the new scheme).

Pair major changes with a dated note in [DECISIONS.md](DECISIONS.md) if they affect migration or the Next.js adapter.
