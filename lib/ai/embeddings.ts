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

function parseOllamaEmbedJson(data: unknown): number[] | null {
  if (!data || typeof data !== "object") {
    return null;
  }
  const o = data as Record<string, unknown>;
  const embeddings = o.embeddings;
  if (Array.isArray(embeddings) && embeddings.length > 0) {
    const first = embeddings[0];
    if (
      Array.isArray(first) &&
      first.length > 0 &&
      typeof first[0] === "number"
    ) {
      return first;
    }
  }
  const embedding = o.embedding;
  if (Array.isArray(embedding) && embedding.length > 0) {
    return embedding as number[];
  }
  return null;
}

/**
 * Calls Ollama `POST /api/embed` (current) with fallback to legacy `POST /api/embeddings`.
 * Returns null on failure (offline, wrong model, etc.).
 */
const OLLAMA_EMBED_TIMEOUT_MS = 12_000;

export async function embedText(text: string): Promise<number[] | null> {
  const trimmed = text.trim();
  if (trimmed.length === 0) {
    return null;
  }
  const baseUrl = getOllamaBaseUrl();
  const model = getEmbeddingModel();
  try {
    const modern = await fetch(`${baseUrl}/api/embed`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        input: trimmed,
      }),
      signal: AbortSignal.timeout(OLLAMA_EMBED_TIMEOUT_MS),
    });
    if (modern.ok) {
      const raw = (await modern.json()) as unknown;
      const vec = parseOllamaEmbedJson(raw);
      if (!vec) {
        return null;
      }
      return normalizeEmbeddingForStorage(vec);
    }

    // Missing model / bad route: legacy uses the same model name and will not help.
    if (modern.status === 404) {
      return null;
    }

    const legacy = await fetch(`${baseUrl}/api/embeddings`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        prompt: trimmed,
      }),
      signal: AbortSignal.timeout(OLLAMA_EMBED_TIMEOUT_MS),
    });
    if (!legacy.ok) {
      return null;
    }
    const raw = (await legacy.json()) as unknown;
    const vec = parseOllamaEmbedJson(raw);
    if (!vec) {
      return null;
    }
    return normalizeEmbeddingForStorage(vec);
  } catch {
    return null;
  }
}

export function vectorLiteralForPg(embedding: number[]): string {
  return `[${embedding.join(",")}]`;
}
