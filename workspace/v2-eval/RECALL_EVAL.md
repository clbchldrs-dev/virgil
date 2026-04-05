# Recall quality evaluation (E11 Phase 1)

Use this checklist when comparing **before** and **after** pgvector recall.

1. Enable `V2_EVAL_LOGGING=true` and capture `interactions.jsonl` on representative chats (include turns where `recallMemoryInvoked` is true).
2. Note `recentMemoryRowsInPrompt` and `toolsUsed` for those turns.
3. After enabling vector search (`pnpm db:migrate`, Ollama with `nomic-embed-text` pulled, optional `pnpm db:backfill-embeddings`), repeat similar queries with the same seeded `Memory` rows.
4. Compare: same or better relevance in assistant behavior; no regression on injected memory counts or obvious FTS-only gaps.

Automated: `tests/unit/v2-eval-extract-tools.test.ts` and embedding helpers; full vector search needs Postgres with the `vector` extension.
