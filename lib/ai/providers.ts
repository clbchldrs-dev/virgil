import { customProvider, gateway, type LanguageModel } from "ai";
import { createOllama } from "ai-sdk-ollama";
import { isTestEnvironment } from "../constants";
import { VirgilError } from "../errors";
import type { ChatModel } from "./models";
import { isLocalModel, resolveRuntimeModelId, titleModel } from "./models";

/** Options passed to Ollama chat (including `think` for visible reasoning when supported). */
export type OllamaLanguageModelOptions = NonNullable<
  ChatModel["ollamaOptions"]
> & {
  think?: boolean;
};

export const myProvider = isTestEnvironment
  ? (() => {
      const { chatModel, titleModel } = require("./models.mock");
      return customProvider({
        languageModels: {
          "chat-model": chatModel,
          "title-model": titleModel,
        },
      });
    })()
  : null;

/** AI SDK 6 requires LanguageModelV3; `ai-sdk-ollama` implements it (legacy `ollama-ai-provider` was v1-only). */
export const DEFAULT_OLLAMA_BASE_URL = "http://127.0.0.1:11434";

export function getOllamaBaseUrl(): string {
  return process.env.OLLAMA_BASE_URL || DEFAULT_OLLAMA_BASE_URL;
}

const ollamaProvider = createOllama({
  baseURL: getOllamaBaseUrl(),
});

export function getOllamaConnectionErrorCause(
  error: unknown,
  baseUrl = getOllamaBaseUrl()
): string | null {
  if (!(error instanceof Error)) {
    return null;
  }

  const text = `${error.name} ${error.message}`.toLowerCase();
  if (
    text.includes("fetch failed") ||
    text.includes("econnrefused") ||
    text.includes("connect") ||
    text.includes("socket") ||
    text.includes("undici")
  ) {
    return `Ollama is not reachable at ${baseUrl}`;
  }

  return null;
}

const OLLAMA_FULL_MESSAGE_PREFIX = "__FULL__:" as const;

/**
 * User-safe explanation for Ollama failures (connection, missing model, timeouts).
 * Connection errors return the same wording as today; other cases use __FULL__ prefix
 * so {@link VirgilError} does not prepend "Ollama is not reachable at …".
 */
export function getOllamaErrorUserPayload(
  error: unknown,
  baseUrl = getOllamaBaseUrl()
): string | null {
  const connection = getOllamaConnectionErrorCause(error, baseUrl);
  if (connection) {
    return connection;
  }

  if (!(error instanceof Error)) {
    return null;
  }

  const raw = `${error.name} ${error.message}`;
  const lower = raw.toLowerCase();

  const looksLikeMissingModel =
    (lower.includes("not found") &&
      (lower.includes("model") || lower.includes("file"))) ||
    lower.includes("model '") ||
    /status\s+code:\s*404/.test(lower) ||
    (lower.includes("does not exist") && lower.includes("model"));

  if (looksLikeMissingModel) {
    return `${OLLAMA_FULL_MESSAGE_PREFIX}That Ollama model is not installed or the name does not match. Run \`ollama list\` to see local models, or \`ollama pull <name>\` to download weights. (endpoint: ${baseUrl})`;
  }

  if (lower.includes("timeout") || lower.includes("timed out")) {
    return `${OLLAMA_FULL_MESSAGE_PREFIX}Ollama stopped responding in time. Try a smaller model, reduce context, or check load on the machine running Ollama (${baseUrl}).`;
  }

  if (lower.includes("context") && lower.includes("length")) {
    return `${OLLAMA_FULL_MESSAGE_PREFIX}The request exceeded this model's context window. Start a shorter chat or pick a preset with a smaller context in the model menu.`;
  }

  const sanitized = error.message.replace(/\/[^\s]+/g, "(path)").slice(0, 220);
  return `${OLLAMA_FULL_MESSAGE_PREFIX}Ollama reported an error: ${sanitized}. If this persists, check \`ollama list\` and the Ollama service logs.`;
}

/** Message for SSE/stream onError (plain text, no VirgilError wrapper). */
export function getOllamaErrorStreamMessage(
  error: unknown,
  baseUrl = getOllamaBaseUrl()
): string | null {
  const payload = getOllamaErrorUserPayload(error, baseUrl);
  if (!payload) {
    return null;
  }
  if (payload.startsWith("__FULL__:")) {
    return payload.slice("__FULL__:".length);
  }
  return `${payload}. Start Ollama and verify OLLAMA_BASE_URL.`;
}

/** Skip repeated /api/tags probes during active chat (per base URL). */
const OLLAMA_REACHABILITY_TTL_MS = 25_000;
const ollamaReachabilityCache = new Map<string, number>();

export async function assertOllamaReachable(baseUrl = getOllamaBaseUrl()) {
  const now = Date.now();
  const lastOk = ollamaReachabilityCache.get(baseUrl) ?? 0;
  if (now - lastOk < OLLAMA_REACHABILITY_TTL_MS) {
    return;
  }

  try {
    const response = await fetch(`${baseUrl}/api/tags`, {
      method: "GET",
      cache: "no-store",
    });

    if (!response.ok) {
      throw new VirgilError("offline:ollama", baseUrl);
    }
    ollamaReachabilityCache.set(baseUrl, Date.now());
  } catch (error) {
    throw new VirgilError(
      "offline:ollama",
      getOllamaConnectionErrorCause(error, baseUrl) ?? baseUrl
    );
  }
}

function getOllamaModel(
  modelId: string,
  extra?: OllamaLanguageModelOptions
): LanguageModel {
  const ollamaModelName = resolveRuntimeModelId(modelId).replace(
    /^ollama\//,
    ""
  );
  if (!extra || Object.keys(extra).length === 0) {
    return ollamaProvider(ollamaModelName) as LanguageModel;
  }

  const { think, ...options } = extra;
  const settings: {
    options?: NonNullable<ChatModel["ollamaOptions"]>;
    think?: boolean;
  } = {};

  if (Object.keys(options).length > 0) {
    settings.options = options;
  }

  if (think === true) {
    settings.think = true;
  }

  return Object.keys(settings).length > 0
    ? (ollamaProvider(ollamaModelName, settings) as LanguageModel)
    : (ollamaProvider(ollamaModelName) as LanguageModel);
}

export function getLanguageModel(
  modelId: string,
  ollamaOptions?: OllamaLanguageModelOptions
): LanguageModel {
  if (isTestEnvironment && myProvider) {
    return myProvider.languageModel("chat-model") as LanguageModel;
  }

  if (isLocalModel(modelId)) {
    return getOllamaModel(modelId, ollamaOptions);
  }

  return gateway.languageModel(modelId) as LanguageModel;
}

export function getTitleModel(): LanguageModel {
  if (isTestEnvironment && myProvider) {
    return myProvider.languageModel("title-model") as LanguageModel;
  }
  if (isLocalModel(titleModel.id)) {
    return getOllamaModel(titleModel.id);
  }
  return gateway.languageModel(titleModel.id) as LanguageModel;
}
