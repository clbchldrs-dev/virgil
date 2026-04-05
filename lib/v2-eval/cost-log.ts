import fs from "node:fs/promises";
import path from "node:path";
import type { FallbackTierLogged } from "@/lib/v2-eval/interaction-log";

const COST_LOG_PATH = path.join(
  process.cwd(),
  "workspace",
  "v2-eval",
  "costs.jsonl"
);

export type GatewayCostRecord = {
  timestamp: string;
  chatId: string;
  requestedModelId: string;
  effectiveModelId: string;
  fallbackTier: FallbackTierLogged;
  inputTokens: number | null;
  outputTokens: number | null;
  totalTokens: number | null;
};

function isCostLoggingEnabled(): boolean {
  return (
    process.env.V2_EVAL_LOGGING === "true" ||
    process.env.V2_COST_LOGGING === "true"
  );
}

export async function logGatewayCost(record: GatewayCostRecord): Promise<void> {
  if (!isCostLoggingEnabled()) {
    return;
  }

  if (
    !(record.fallbackTier === "gateway" || record.fallbackTier === "gemini")
  ) {
    return;
  }

  try {
    const line = `${JSON.stringify(record)}\n`;
    await fs.appendFile(COST_LOG_PATH, line, "utf-8");
  } catch {
    // Silent fail — evaluation logging should never affect chat.
  }
}
