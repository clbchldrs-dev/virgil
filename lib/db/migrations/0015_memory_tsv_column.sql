-- Repair Memory full-text search: DBs that have "Memory" without the generated "tsv" column
-- (partial applies, forks, or pre-0002 tables) break recallMemory FTS. Safe no-op if column exists.
ALTER TABLE "Memory"
  ADD COLUMN IF NOT EXISTS "tsv" tsvector
  GENERATED ALWAYS AS (to_tsvector('english', "content")) STORED;

CREATE INDEX IF NOT EXISTS "Memory_tsv_idx" ON "Memory" USING GIN ("tsv");
