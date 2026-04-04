import { VirgilError } from "@/lib/errors";

export type FallbackTier = "ollama" | "gemini" | "gateway";

const DEFAULT_FALLBACK_GEMINI_MODEL = "gemini-2.5-flash";

export function isChatFallbackEnabled(): boolean {
  const v = process.env.VIRGIL_CHAT_FALLBACK;
  return v === "1" || v === "true";
}

export function isGeminiDirectConfigured(): boolean {
  return Boolean(process.env.GOOGLE_GENERATIVE_AI_API_KEY?.trim());
}

export function getFallbackGeminiModel(): string {
  return (
    process.env.VIRGIL_FALLBACK_GEMINI_MODEL?.trim() ||
    DEFAULT_FALLBACK_GEMINI_MODEL
  );
}

export function getFallbackGatewayModel(): string {
  return (
    process.env.VIRGIL_FALLBACK_GATEWAY_MODEL?.trim() ||
    "deepseek/deepseek-v3.2"
  );
}

/**
 * Ordered fallback tiers after Ollama fails.
 * Gemini is included only when GOOGLE_GENERATIVE_AI_API_KEY is set;
 * gateway is always available as last resort.
 */
export function getFallbackTiers(): FallbackTier[] {
  const tiers: FallbackTier[] = [];
  if (isGeminiDirectConfigured()) {
    tiers.push("gemini");
  }
  tiers.push("gateway");
  return tiers;
}

/**
 * True if the error should trigger fallback (pre-stream failures only).
 * Covers connection refused, unreachable host, missing model, and timeouts.
 * Does NOT match content refusals or partial-stream errors.
 */
export function isFallbackEligibleError(error: unknown): boolean {
  if (error instanceof VirgilError) {
    return error.type === "offline" && error.surface === "ollama";
  }
  if (!(error instanceof Error)) {
    return false;
  }
  const text = `${error.name} ${error.message}`.toLowerCase();
  return (
    text.includes("fetch failed") ||
    text.includes("econnrefused") ||
    text.includes("connect") ||
    text.includes("socket") ||
    text.includes("undici") ||
    text.includes("not reachable") ||
    (text.includes("not found") &&
      (text.includes("model") || text.includes("file"))) ||
    text.includes("timeout") ||
    text.includes("timed out") ||
    /status\s+code:\s*404/.test(text)
  );
}
