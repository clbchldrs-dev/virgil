-- pgvector semantic recall (E11 Phase 1). Requires Postgres with vector extension (Neon, Supabase, local pgvector).
CREATE EXTENSION IF NOT EXISTS vector;

ALTER TABLE "Memory" ADD COLUMN IF NOT EXISTS "embedding" vector(768);

CREATE INDEX IF NOT EXISTS "Memory_embedding_idx"
  ON "Memory" USING ivfflat ("embedding" vector_cosine_ops)
  WITH (lists = 100);
