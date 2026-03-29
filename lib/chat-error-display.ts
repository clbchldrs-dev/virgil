import { isLocalModel } from "@/lib/ai/models";
import { ChatbotError } from "@/lib/errors";

/** User-visible text for any chat request error (API or stream). */
export function describeChatError(error: unknown): string {
  if (error instanceof ChatbotError) {
    return error.message;
  }
  if (error instanceof Error && error.message) {
    return error.message;
  }
  return "Something went wrong. Please try again.";
}

/** Heuristic: error text looks like an Ollama/local runtime issue (for styling). */
export function isLikelyLocalModelErrorText(message: string): boolean {
  const m = message.toLowerCase();
  return (
    m.includes("ollama") ||
    m.includes("ollama_base_url") ||
    m.includes("econnrefused") ||
    m.includes("fetch failed") ||
    m.includes("not installed") ||
    m.includes("context window") ||
    m.includes("timed out") ||
    m.includes("model is not")
  );
}

export function shouldEmphasizeLocalModelError(
  error: unknown,
  selectedModelId: string
): boolean {
  return (
    isLocalModel(selectedModelId) ||
    isLikelyLocalModelErrorText(describeChatError(error))
  );
}
