import { assertOllamaReachable } from "@/lib/ai/providers";

export type ClientRoutingHints = {
  saveData?: boolean;
  effectiveConnectionType?: string;
  platform?: string;
};

const DEFAULT_AUTO_LOCAL = "ollama/qwen2.5:3b";
const DEFAULT_AUTO_HOSTED = "google/gemini-2.5-flash-lite";

function getAutoLocalModelId(): string {
  return process.env.VIRGIL_AUTO_LOCAL_MODEL?.trim() || DEFAULT_AUTO_LOCAL;
}

function getAutoHostedFallbackModelId(): string {
  return (
    process.env.VIRGIL_AUTO_HOSTED_FALLBACK_MODEL?.trim() || DEFAULT_AUTO_HOSTED
  );
}

/**
 * Resolves **virgil/auto** to a concrete chat model id.
 * Prefer local Ollama when the server can reach it; otherwise {@link getAutoHostedFallbackModelId}.
 * `_hints` are forwarded from the client for future tuning (save-data / connection labels).
 */
export async function resolveAutoChatModel(
  _hints: ClientRoutingHints | undefined
): Promise<{ modelId: string }> {
  const localId = getAutoLocalModelId();
  const hostedId = getAutoHostedFallbackModelId();

  try {
    await assertOllamaReachable();
    return { modelId: localId };
  } catch {
    return { modelId: hostedId };
  }
}
