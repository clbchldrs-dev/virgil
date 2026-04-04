# pgvector semantic recall on Supabase Postgres — design sketch

**Parent:** Phase 1 of [proactive-pivot-epic](2026-04-02-proactive-pivot-epic.md)
**ADR:** [DECISIONS.md](../DECISIONS.md) — 2026-04-02 (hybrid: FTS baseline, pgvector in same Postgres, FTS retained as fallback)
**Status:** Design only — not in development

## Goal

Replace optional Mem0 with **on-Postgres semantic recall** using pgvector + Ollama embeddings, so local-first users get vector search without a hosted API key.

## Prerequisites

- Supabase (or Neon) as Postgres host — both support pgvector
- Local Ollama with an embedding model (e.g. `nomic-embed-text` or `mxbai-embed-large`)

## Migration

```sql
-- 0010_memory_embedding.sql
CREATE EXTENSION IF NOT EXISTS vector;

ALTER TABLE "Memory" ADD COLUMN IF NOT EXISTS "embedding" vector(768);

CREATE INDEX IF NOT EXISTS "Memory_embedding_idx"
  ON "Memory" USING ivfflat ("embedding" vector_cosine_ops)
  WITH (lists = 100);
```

Notes:
- Dimension `768` matches `nomic-embed-text`; adjust if a different model is chosen.
- `ivfflat` is a good starting index for the expected row count (< 100K); switch to `hnsw` if recall degrades at scale.
- Supabase enables `vector` extension via dashboard or `CREATE EXTENSION`; Neon supports it in the free tier.

## Schema change (Drizzle)

Add an optional `embedding` column to the `memory` table in `lib/db/schema.ts`. Drizzle does not have native pgvector column support, so use a raw SQL column type or `drizzle-orm/pg-core` custom type.

## Embedding pipeline

### On write (post-turn + saveMemory tool)

1. After `saveMemoryRecord()`, generate an embedding via local Ollama: `POST http://<OLLAMA_BASE_URL>/api/embeddings` with model and prompt = memory content.
2. `UPDATE "Memory" SET "embedding" = $vector WHERE "id" = $id`.
3. Fire-and-forget (same pattern as current Mem0 `mem0AddText` — catch and discard errors so writes never block the chat response).

### On recall (recallMemory tool)

Priority order in `recall-memory.ts`:

```
1. pgvector cosine similarity  (if embedding column populated)
2. Postgres FTS                (always available as fallback)
3. Mem0 search                 (if MEM0_API_KEY set — retained for transition)
```

Query sketch:

```sql
SELECT *, 1 - ("embedding" <=> $query_embedding) AS similarity
FROM "Memory"
WHERE "userId" = $1
  AND "embedding" IS NOT NULL
ORDER BY "embedding" <=> $query_embedding
LIMIT $2;
```

If pgvector returns zero results (e.g. old rows without embeddings), fall through to existing FTS.

## Backfill

A one-time script to embed existing Memory rows that have `embedding IS NULL`:

```bash
pnpm db:backfill-embeddings
```

Batch rows, call Ollama embeddings endpoint, update in place. Rate-limit to avoid saturating local inference.

## Recall ranking (follow-up ADR required)

The 2026-04-02 ADR says making vector search rank **before** FTS requires a follow-up ADR at merge time. Options:

- **Vector-first, FTS fallback:** Simpler. Use vector results when they exist; fall to FTS for rows without embeddings or when Ollama is offline.
- **Hybrid merge:** Run both queries, merge by reciprocal rank fusion (RRF). Better recall quality but more complex and two queries per tool call.

Recommendation: Start with **vector-first, FTS fallback** for simplicity; measure recall quality before adding RRF.

## Mem0 transition

- Mem0 stays optional during transition (`MEM0_API_KEY`).
- Once pgvector covers all rows, Mem0 can be removed (env var + client code + budget tracking).
- No user-facing change needed — `recallMemory` tool result shape is identical regardless of backend.

## Files touched

| File | Change |
|------|--------|
| `lib/db/migrations/0010_memory_embedding.sql` | New migration |
| `lib/db/schema.ts` | Add `embedding` column |
| `lib/db/query-modules/memory.ts` | Add `searchMemoriesByVector()`, update `saveMemoryRecord()` |
| `lib/ai/tools/recall-memory.ts` | Insert pgvector path before FTS |
| `lib/ai/tools/save-memory.ts` | Call embedding after save |
| `app/(chat)/api/chat/route.ts` | Post-turn embedding (mirrors Mem0 ingest path) |
| New: `lib/ai/embeddings.ts` | Ollama embedding client wrapper |
| New: `scripts/backfill-embeddings.ts` | One-time backfill script |

## Env vars (new)

| Variable | Required | Notes |
|----------|----------|-------|
| `EMBEDDING_MODEL` | No | Ollama model tag for embeddings (default `nomic-embed-text`) |
| `EMBEDDING_DIMENSIONS` | No | Must match migration dimension (default `768`) |

## Out of scope

- Replacing the entire `Memory` table with a vector-only store (FTS fallback is required per ADR).
- Supabase client SDK or RLS — stay on Drizzle + server-side auth.
- Embedding during chat streaming (only post-turn and on explicit save).
