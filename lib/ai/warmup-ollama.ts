import { resolveRuntimeModelId } from "./models";

const DEFAULT_WARMUP_PROMPT = ".";

export type WarmupOllamaOptions = {
  baseUrl: string;
  /** Full id (e.g. `ollama/qwen2.5:3b-turbo`) or runtime tag (`qwen2.5:3b`). */
  modelId: string;
  /** Minimal neutral text; default is a single period. */
  prompt?: string;
  signal?: AbortSignal;
};

function toOllamaApiModelName(modelId: string): string {
  const resolved = resolveRuntimeModelId(modelId);
  return resolved.replace(/^ollama\//, "");
}

/**
 * Loads (or keeps loaded) a model via Ollama HTTP API with `keep_alive: -1` so weights
 * stay resident until the Ollama process exits or the model is unloaded.
 */
export async function warmupOllamaModel(
  options: WarmupOllamaOptions
): Promise<void> {
  const { baseUrl, modelId, prompt = DEFAULT_WARMUP_PROMPT, signal } = options;
  const model = toOllamaApiModelName(modelId);
  const url = `${baseUrl.replace(/\/$/, "")}/api/generate`;

  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      model,
      prompt,
      stream: false,
      keep_alive: -1,
    }),
    signal,
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(
      `Ollama warmup failed: HTTP ${res.status} ${res.statusText}${text ? ` — ${text.slice(0, 300)}` : ""}`
    );
  }

  const json = (await res.json()) as { done?: boolean; error?: string };
  if (json.error) {
    throw new Error(`Ollama warmup error: ${json.error}`);
  }
}
