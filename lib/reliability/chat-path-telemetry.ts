import { MissingToolResultsError } from "ai";
import { isLocalModel } from "@/lib/ai/models";

type TelemetryPath = "gateway" | "ollama";
type TelemetryFallbackTier = "gateway" | "gemini" | "ollama" | null;
type TelemetryOutcome = "completed" | "error";
type TelemetryInsertFn = (input: {
  userId: string;
  chatId?: string | null;
  requestedModelId: string;
  effectiveModelId: string;
  requestedPath: TelemetryPath;
  effectivePath: TelemetryPath;
  fallbackTier: TelemetryFallbackTier;
  outcome: TelemetryOutcome;
  errorCode?: string | null;
}) => Promise<void>;

function getPathFromModelId(modelId: string): TelemetryPath {
  return isLocalModel(modelId) ? "ollama" : "gateway";
}

export function normalizeChatTelemetryErrorCode(error: unknown): string {
  if (MissingToolResultsError.isInstance(error)) {
    return "missing_tool_results";
  }
  if (error instanceof Error) {
    const text = `${error.name} ${error.message}`.toLowerCase();
    if (text.includes("status code: 401") || text.includes("unauthorized")) {
      return "unauthorized";
    }
    if (text.includes("status code: 429") || text.includes("rate limit")) {
      return "rate_limited";
    }
    if (text.includes("timeout") || text.includes("timed out")) {
      return "timeout";
    }
    if (text.includes("econnrefused") || text.includes("not reachable")) {
      return "unreachable";
    }
    if (text.includes("not found") && text.includes("model")) {
      return "model_not_found";
    }
  }
  return "unknown_error";
}

export async function logChatPathTelemetryEvent({
  userId,
  chatId,
  requestedModelId,
  effectiveModelId,
  fallbackTier,
  outcome,
  errorCode,
  insertFn,
}: {
  userId: string;
  chatId: string;
  requestedModelId: string;
  effectiveModelId: string;
  fallbackTier: TelemetryFallbackTier;
  outcome: TelemetryOutcome;
  errorCode?: string;
  insertFn?: TelemetryInsertFn;
}): Promise<void> {
  const writeTelemetry =
    insertFn ??
    (async (input: Parameters<TelemetryInsertFn>[0]) => {
      const { insertChatPathTelemetry } = await import("@/lib/db/queries");
      await insertChatPathTelemetry(input);
    });

  await writeTelemetry({
    userId,
    chatId,
    requestedModelId,
    effectiveModelId,
    requestedPath: getPathFromModelId(requestedModelId),
    effectivePath: getPathFromModelId(effectiveModelId),
    fallbackTier,
    outcome,
    errorCode: errorCode ?? null,
  });
}
