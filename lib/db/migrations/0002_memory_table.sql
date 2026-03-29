CREATE TABLE IF NOT EXISTS "Memory" (
  "id"        uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "userId"    uuid NOT NULL REFERENCES "User"("id"),
  "chatId"    uuid REFERENCES "Chat"("id"),
  "kind"      varchar NOT NULL DEFAULT 'note',
  "content"   text NOT NULL,
  "metadata"  jsonb NOT NULL DEFAULT '{}',
  "tsv"       tsvector GENERATED ALWAYS AS (to_tsvector('english', "content")) STORED,
  "createdAt" timestamp DEFAULT now() NOT NULL,
  "updatedAt" timestamp DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "Memory_tsv_idx" ON "Memory" USING GIN ("tsv");
CREATE INDEX IF NOT EXISTS "Memory_userId_kind_idx" ON "Memory" ("userId", "kind");
CREATE INDEX IF NOT EXISTS "Memory_userId_createdAt_idx" ON "Memory" ("userId", "createdAt" DESC);
