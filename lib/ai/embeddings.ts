import "server-only";

import { normalizeEmbeddingForStorage } from "@/lib/ai/embedding-normalize";
import { getOllamaBaseUrl } from "@/lib/ai/providers";

export {
  getEmbeddingDimensions,
  MEMORY_VECTOR_DIMENSIONS,
  normalizeEmbeddingForStorage,
} from "@/lib/ai/embedding-normalize";

export function getEmbeddingModel(): string {
  return process.env.EMBEDDING_MODEL?.trim() || "nomic-embed-text";
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
    return normalizeEmbeddingForStorage(data.embedding);
  } catch {
    return null;
  }
}

export function vectorLiteralForPg(embedding: number[]): string {
  return `[${embedding.join(",")}]`;
}
