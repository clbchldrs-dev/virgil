import "server-only";

import type { LanguageModel } from "ai";

import {
  getChatModel,
  getChatModelWithLocalFallback,
  isLocalModel,
} from "@/lib/ai/models";
import {
  getLanguageModel,
  type OllamaLanguageModelOptions,
} from "@/lib/ai/providers";

/**
 * Night review uses {@link generateObject} on a schedule. Only **local Ollama**
 * (`ollama/…`) is allowed — no Gemini or AI Gateway — to avoid cloud token spend.
 */
export function resolveNightReviewLanguageModel(
  modelId: string,
  ollamaOptions?: OllamaLanguageModelOptions
): { ok: true; model: LanguageModel } | { ok: false; reason: string } {
  if (isLocalModel(modelId)) {
    return {
      ok: true,
      model: getLanguageModel(modelId, ollamaOptions),
    };
  }

  return {
    ok: false,
    reason:
      "NIGHT_REVIEW_MODEL must be an ollama/… id (local inference only). Gemini and other hosted ids are not used for night review.",
  };
}

/** Resolve ollama options from the curated roster (or local fallback) for night review. */
export function getNightReviewChatModelProfile(modelId: string) {
  return getChatModel(modelId) ?? getChatModelWithLocalFallback(modelId);
}
