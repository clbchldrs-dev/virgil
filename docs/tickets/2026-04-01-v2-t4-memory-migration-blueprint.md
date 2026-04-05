# V2-T4 — Memory migration blueprint (Postgres → v2 tiers)

**Track:** V2 groundwork — [overview](2026-04-01-v2-groundwork-overview.md)  
**Status:** Done — [docs/V2_MEMORY_MIGRATION.md](../V2_MEMORY_MIGRATION.md)

## Problem

[V2_MIGRATION.md](../V2_MIGRATION.md) says v2 moves to **SQLite + Mem0** with priority tiers. v1 **`Memory`** rows and metadata (e.g. night-review `source`) are not documented for export.

## Goal

Add **`docs/V2_MEMORY_MIGRATION.md`** describing:

1. **Schema reference:** [`lib/db/schema.ts`](../../lib/db/schema.ts) — `Memory` table columns, `kind` enum or freeform values in use, `metadata` JSON conventions (document real keys: `source`, `phase`, night-review fields, etc.).
2. **Tier mapping proposal:** which rows become v2 L1/L2/L3 (e.g. hot recent vs mem0 vs archive); what is **not** migrated (ephemeral chat messages policy).
3. **Export approach:** SQL `COPY`/CSV vs Drizzle script vs one-off `pnpm` script—pick one recommended path for June 2026, no implementation required in this ticket unless trivial.
4. **Deduplication / night-review:** how accepted vs dismissed memories should affect migration.

## Non-goals

- Running migration on production data.
- Changing Drizzle schema.

## Acceptance criteria

1. Doc exists; links from [V2_MIGRATION.md](../V2_MIGRATION.md) “Migrate relevant Postgres data” step.
2. Lists **at least** three `metadata` keys used in production code paths with file pointers.
3. Explicit **risk** callout: secrets or large blobs in memory content (should be none).

## Key files

- `lib/db/schema.ts`
- `lib/db/query-modules/*` (memory queries)
- `lib/night-review/*`, `app/api/memories/*`
