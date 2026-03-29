# Virgil night-review workspace

These Markdown files are loaded **server-side only** when the nightly review job runs. They mirror the **lightweight workspace** pattern used by [OpenClaw](https://docs.openclaw.ai/gateway/heartbeat) (`HEARTBEAT.md`, `SOUL.md`) and [NemoClaw](https://docs.nvidia.com/nemoclaw/latest/workspace/workspace-files.html) (workspace files under `.openclaw/workspace`), without bundling those runtimes.

- **[HEARTBEAT.md](./HEARTBEAT.md)** — Checklist for what each night run should consider (keep short; no secrets).
- **[SOUL.md](./SOUL.md)** — Persona and boundaries for the reviewer model.
- **[SKILLS.md](./SKILLS.md)** — Catalog of current capabilities plus a place to record **proposed** skills (suggestions only; not auto-executed).

Edit these files in git like normal app config. The night job does not write them back in v1.

**`/night-insights` (trust boundary):** Accept / dismiss only updates **`Memory.metadata`** (`reviewDecision`, `reviewedAt`) via `PATCH /api/memories/night-review/[id]`. It does **not** write to `SOUL.md`, workspace files, or system prompts. Findings remain **suggest-only** until you act elsewhere (e.g. editing git-tracked files yourself).

**Search / storage:** Memories are indexed with Postgres **`tsvector`** on `content` (`Memory.tsv`, GIN index — see `lib/db/migrations/0002_memory_table.sql`). `recallMemory` uses `to_tsquery` / `@@` FTS, not a separate vector database. Accepting a night-review row does not add new infrastructure beyond the existing `Memory` row.
