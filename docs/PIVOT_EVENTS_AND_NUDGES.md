# Proactive pivot — events backbone and nudge delivery (topology)

**Status:** Design SSOT for pivot Phase 3 (external prompt).  
**Related:** [docs/tickets/2026-04-02-proactive-pivot-epic.md](tickets/2026-04-02-proactive-pivot-epic.md), [AGENTS.md](../AGENTS.md) (QStash ADR), [docs/DECISIONS.md](DECISIONS.md).

## Decision: two deployment profiles

| Profile | Recommended backbone | Rationale |
|---------|---------------------|-----------|
| **Vercel / serverless** | **QStash + HTTPS routes + cron** (existing pattern) | No long-lived Redis consumer; matches reminder/digest architecture. |
| **LAN Docker / always-on host** | **Optional Redis Streams** consumer groups | Pivot prompt’s `XREADGROUP` loop fits a `virgil-app` sidecar or separate Node worker container. |

**Default for v1:** implement **QStash/cron-first** nudge generation and storage; treat Redis Streams as **Phase 3b** when the operator runs an always-on stack and opts in.

## Unified logical model (both profiles)

1. **Producers** detect stale goals, Jira deadlines, calendar (stub), etc.
2. **Nudge records** persist in Postgres (`Notification` table — to be added in implementation ticket).
3. **Delivery:** client polls `GET /api/notifications` or chat route injects high-priority pending rows into context (per pivot prompt).

## Stub API contract (implementation ticket will follow)

**`GET /api/notifications`** (authenticated)

- Query: `?status=pending` (default), optional `limit`.
- Response JSON:

```json
{
  "notifications": [
    {
      "id": "uuid",
      "eventType": "habit_stale",
      "message": "string",
      "priority": "normal",
      "status": "pending",
      "createdAt": "ISO-8601",
      "metadata": {}
    }
  ]
}
```

**`PATCH /api/notifications`** (authenticated)

- Body: `{ "id": "uuid", "status": "delivered" | "dismissed" | "acted_on" }`.
- Returns updated row or 404.

## UI scope (minimal)

- Dismissible **banner** or **pinned card** above chat when `pending.length > 0`.
- Actions: **Dismiss**, **Act on this** (pre-fills user message — e.g. draft send to chat input).
- Copy must stay **suggest-only** for destructive work ([OWNER_PRODUCT_VISION.md](OWNER_PRODUCT_VISION.md)).

## Redis Streams (optional / LAN)

- Streams: `virgil:events:calendar`, `virgil:events:jira`, `virgil:events:habits`, `virgil:events:system`.
- **Consumer** process writes to the same `Notification` table as QStash-driven jobs so the API stays one surface.
- **Do not** require Streams for Vercel Hobby parity.

## Processors (cron entrypoints)

- `pnpm run process:habits` — query stale goals ([goals design ticket](tickets/2026-04-02-pivot-goals-layer-design.md)), enqueue nudge rows or publish events.
- `pnpm run process:jira` — poll Jira; deadline / transition events.
- `pnpm run process:calendar` — stub until OAuth/calendar integration exists.

## v2 migration note

When `Notification` or event schemas land, update [docs/tickets/2026-04-01-v2-t4-memory-migration-blueprint.md](tickets/2026-04-01-v2-t4-memory-migration-blueprint.md) and [docs/tickets/2026-04-01-v2-t1-api-contract-for-python-backend.md](tickets/2026-04-01-v2-t1-api-contract-for-python-backend.md) if nudges become part of the future Python API.
