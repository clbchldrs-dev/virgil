/**
 * Shared embedding dimension helpers (safe for unit tests; no `server-only`).
 * Ollama embedding calls live in `lib/ai/embeddings.ts`.
 */

/** Must match `lib/db/migrations/0010_memory_embedding.sql` `vector(N)`. */
export const MEMORY_VECTOR_DIMENSIONS = 768 as const;

export function getEmbeddingDimensions(): number {
  const raw = process.env.EMBEDDING_DIMENSIONS?.trim();
  if (!raw) {
    return MEMORY_VECTOR_DIMENSIONS;
  }
  const n = Number.parseInt(raw, 10);
  if (!Number.isFinite(n) || n <= 0) {
    return MEMORY_VECTOR_DIMENSIONS;
  }
  return n;
}

function normalizeEmbedding(embedding: number[], dimensions: number): number[] {
  if (embedding.length === dimensions) {
    return embedding;
  }
  if (embedding.length > dimensions) {
    return embedding.slice(0, dimensions);
  }
  const padded = [...embedding];
  while (padded.length < dimensions) {
    padded.push(0);
  }
  return padded;
}

export function normalizeEmbeddingForStorage(embedding: number[]): number[] {
  return normalizeEmbedding(embedding, getEmbeddingDimensions());
}
