import { DEFAULT_CHAT_MODEL } from "@/lib/ai/models";
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
    process.env.VIRGIL_FALLBACK_GATEWAY_MODEL?.trim() || DEFAULT_CHAT_MODEL
  );
}

/** Bare Gemini model name for direct Google API when the AI Gateway path fails (pre-stream). */
export function getGatewayFallbackGeminiModel(): string {
  const fromEnv = process.env.VIRGIL_GATEWAY_FALLBACK_GEMINI_MODEL?.trim();
  if (fromEnv) {
    return fromEnv.replace(/^gemini\//, "");
  }
  return getFallbackGeminiModel().replace(/^gemini\//, "");
}

function collectGatewayErrorText(error: unknown, maxDepth = 6): string {
  const parts: string[] = [];
  let current: unknown = error;
  let depth = 0;
  while (current instanceof Error && depth < maxDepth) {
    parts.push(`${current.name} ${current.message}`);
    current = current.cause;
    depth += 1;
  }
  return parts.join(" ").toLowerCase();
}

/**
 * Obvious gateway credential / auth failures — do not chain to other tiers
 * (avoids masking a broken API key with silent local fallback).
 */
export function isGatewayAuthFailureError(error: unknown): boolean {
  const text = collectGatewayErrorText(error);
  if (text.includes("invalid api key")) {
    return true;
  }
  if (
    text.includes("unauthenticated") &&
    (text.includes("gateway") || text.includes("ai gateway"))
  ) {
    return true;
  }
  if (
    text.includes("authentication failed") &&
    (text.includes("gateway") || text.includes("ai gateway"))
  ) {
    return true;
  }
  if (/status\s+code:\s*401\b/.test(text)) {
    return true;
  }
  if (
    /status\s+code:\s*403\b/.test(text) &&
    !text.includes("rate") &&
    !text.includes("quota") &&
    !text.includes("limit")
  ) {
    return true;
  }
  return false;
}

/** Rate limit / quota signals (pre-stream); excludes {@link isGatewayAuthFailureError}. */
export function isGatewayRateLimitError(error: unknown): boolean {
  if (isGatewayAuthFailureError(error)) {
    return false;
  }
  const text = collectGatewayErrorText(error);
  return (
    text.includes("429") ||
    text.includes("rate limit") ||
    text.includes("too many requests") ||
    text.includes("resource exhausted") ||
    text.includes("resource_exhausted") ||
    text.includes("quota exceeded") ||
    /status\s+code:\s*429\b/.test(text)
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

const DEFAULT_GATEWAY_FALLBACK_OLLAMA_MODEL = "ollama/qwen2.5:7b-instruct";

/** When the selected chat model is a gateway model and it fails pre-stream, retry once with local Ollama. */
export function isGatewayFallbackToOllamaEnabled(): boolean {
  const v = process.env.VIRGIL_GATEWAY_FALLBACK_OLLAMA?.trim().toLowerCase();
  return v === "1" || v === "true" || v === "yes";
}

export function getDefaultGatewayFallbackOllamaModelId(): string {
  return (
    process.env.DEFAULT_GATEWAY_FALLBACK_OLLAMA_MODEL?.trim() ||
    DEFAULT_GATEWAY_FALLBACK_OLLAMA_MODEL
  );
}

/**
 * Errors that justify gateway → (optional) Gemini direct → (optional) Ollama (pre-stream only).
 * Transport-style errors, rate limits, and missing-model style failures; not bare auth failures.
 */
export function isGatewayFallbackEligibleError(error: unknown): boolean {
  if (isGatewayAuthFailureError(error)) {
    return false;
  }
  return isFallbackEligibleError(error) || isGatewayRateLimitError(error);
}
