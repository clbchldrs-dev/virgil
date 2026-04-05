import "server-only";

import { getOllamaBaseUrl } from "@/lib/ai/providers";

export function getEmbeddingModel(): string {
  return process.env.EMBEDDING_MODEL?.trim() || "nomic-embed-text";
}

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

/**
 * Calls Ollama `/api/embeddings`. Returns null on failure (offline, wrong model, etc.).
 */
export async function embedText(text: string): Promise<number[] | null> {
  const trimmed = text.trim();
  if (trimmed.length === 0) {
    return null;
  }
  const baseUrl = getOllamaBaseUrl();
  const model = getEmbeddingModel();
  try {
    const response = await fetch(`${baseUrl}/api/embeddings`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        prompt: trimmed,
      }),
    });
    if (!response.ok) {
      return null;
    }
    const data = (await response.json()) as { embedding?: number[] };
    if (!data.embedding || data.embedding.length === 0) {
      return null;
    }
    return normalizeEmbedding(data.embedding, MEMORY_VECTOR_DIMENSIONS);
  } catch {
    return null;
  }
}

export function vectorLiteralForPg(embedding: number[]): string {
  return `[${embedding.join(",")}]`;
}
