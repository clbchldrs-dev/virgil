import fs from "node:fs/promises";
import path from "node:path";

const TRACE_LOG_PATH = path.join(
  process.cwd(),
  "workspace",
  "v2-eval",
  "traces.jsonl"
);

export type DecisionTraceRecord = {
  timestamp: string;
  chatId: string;
  requestedModelId: string;
  effectiveModelId: string;
  fallbackTier: "ollama" | "gemini" | "gateway" | "none";
  promptVariant: "full" | "slim" | "compact";
  isOllamaLocal: boolean;
  trigger: {
    source: "chat";
    type: "user_message";
  };
  toolsInvoked: string[];
  inputTokens?: number | null;
  outputTokens?: number | null;
  totalTokens?: number | null;
  responseLength: number;
  userMessageLength: number;
  preStreamTimingsMs?: {
    authAndBotCheck: number | null;
    promptContextLoad: number | null;
    totalBeforeFirstModelCall: number | null;
  };
};

export async function logDecisionTrace(
  record: DecisionTraceRecord
): Promise<void> {
  if (process.env.V2_TRACE_LOGGING !== "true") {
    return;
  }

  try {
    const line = `${JSON.stringify(record)}\n`;
    await fs.appendFile(TRACE_LOG_PATH, line, "utf-8");
  } catch {
    // Silent fail — trace logging should never affect chat.
  }
}
