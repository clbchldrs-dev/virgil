import "server-only";

import { google } from "@ai-sdk/google";
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
 * Night review uses {@link generateObject} on a schedule. To avoid burning
 * arbitrary AI Gateway credits, only **local Ollama** (`ollama/…`) or **Gemini**
 * via `GOOGLE_GENERATIVE_AI_API_KEY` (`google/…`) are allowed.
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

  if (modelId.startsWith("google/")) {
    const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY?.trim();
    if (!apiKey) {
      return {
        ok: false,
        reason:
          "Set GOOGLE_GENERATIVE_AI_API_KEY when NIGHT_REVIEW_MODEL is a google/… Gemini id.",
      };
    }
    const geminiModelId = modelId.slice("google/".length).trim();
    if (!geminiModelId) {
      return {
        ok: false,
        reason:
          "Invalid NIGHT_REVIEW_MODEL: google/… must include a model name.",
      };
    }
    return { ok: true, model: google(geminiModelId) };
  }

  return {
    ok: false,
    reason:
      "NIGHT_REVIEW_MODEL must be ollama/… (local) or google/… (Gemini + GOOGLE_GENERATIVE_AI_API_KEY). Other providers are disabled for night review to limit token spend.",
  };
}

/** Resolve ollama options from the curated roster (or local fallback) for night review. */
export function getNightReviewChatModelProfile(modelId: string) {
  return getChatModel(modelId) ?? getChatModelWithLocalFallback(modelId);
}
