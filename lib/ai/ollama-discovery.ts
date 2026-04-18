import {
  allowedModelIds,
  type ChatModel,
  chatModels,
  inferLocalModelClassFromOllamaTag,
  isLocalModel,
  resolveRuntimeModelId,
  VIRGIL_AUTO_MODEL_ID,
} from "./models";
import { getOllamaBaseUrl } from "./providers";

const TAG_CACHE_TTL_MS = 60_000;
let tagNamesCache: { names: string[]; fetchedAt: number } | null = null;

/**
 * Lists Ollama model tag names (e.g. `qwen2.5:3b`) from `/api/tags`, with a short TTL cache.
 */
export async function getOllamaTagNames(): Promise<string[]> {
  const now = Date.now();
  if (tagNamesCache && now - tagNamesCache.fetchedAt < TAG_CACHE_TTL_MS) {
    return tagNamesCache.names;
  }

  const base = getOllamaBaseUrl();
  try {
    const res = await fetch(`${base}/api/tags`, {
      method: "GET",
      cache: "no-store",
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) {
      return tagNamesCache?.names ?? [];
    }
    const json = (await res.json()) as { models?: { name?: string }[] };
    const names = (json.models ?? [])
      .map((m) => m.name)
      .filter((n): n is string => Boolean(n));
    tagNamesCache = { names, fetchedAt: Date.now() };
    return names;
  } catch {
    return tagNamesCache?.names ?? [];
  }
}

/**
 * Drops curated and discovered Ollama entries when the server cannot list matching tags
 * (Ollama unreachable, empty registry, or tag not pulled). Keeps {@link VIRGIL_AUTO_MODEL_ID}
 * so routing can still fall back to hosted models.
 */
export function filterChatModelsByAvailableOllamaTags(
  models: ChatModel[],
  tagNames: string[]
): ChatModel[] {
  if (tagNames.length === 0) {
    return models.filter(
      (m) => !isLocalModel(m.id) || m.id === VIRGIL_AUTO_MODEL_ID
    );
  }
  const nameSet = new Set(tagNames);
  return models.filter((m) => {
    if (m.id === VIRGIL_AUTO_MODEL_ID) {
      return true;
    }
    if (!isLocalModel(m.id)) {
      return true;
    }
    const tag = resolveRuntimeModelId(m.id).replace(/^ollama\//, "");
    return nameSet.has(tag);
  });
}

/** True if this id is allowed: curated roster, or local model whose tag exists in Ollama. */
export async function isAllowedChatModelId(modelId: string): Promise<boolean> {
  if (allowedModelIds.has(modelId)) {
    return true;
  }
  if (!isLocalModel(modelId)) {
    return false;
  }
  const tag = modelId.replace(/^ollama\//, "");
  const names = await getOllamaTagNames();
  return names.includes(tag);
}

/**
 * Extra `ChatModel` rows for Ollama tags not already represented by the curated list
 * (including presets that map to the same weights).
 */
export async function getDiscoveredOllamaChatModels(): Promise<ChatModel[]> {
  const names = await getOllamaTagNames();
  if (names.length === 0) {
    return [];
  }

  const coveredTags = new Set(
    chatModels
      .filter((m) => isLocalModel(m.id))
      .map((m) => resolveRuntimeModelId(m.id).replace(/^ollama\//, ""))
  );

  const out: ChatModel[] = [];
  for (const name of names) {
    const id = `ollama/${name}`;
    if (allowedModelIds.has(id)) {
      continue;
    }
    if (coveredTags.has(name)) {
      continue;
    }
    out.push({
      id,
      name: `${name} (local, discovered)`,
      provider: "ollama",
      description: "Reported by Ollama on this machine — not a curated preset",
      maxContextTokens: 2048,
      ollamaOptions: {
        num_ctx: 2048,
        num_predict: 512,
        temperature: 0.6,
        repeat_penalty: 1.1,
      },
      promptVariant: "slim",
      localModelClass: inferLocalModelClassFromOllamaTag(name),
    });
  }
  return out;
}
