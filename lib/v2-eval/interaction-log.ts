/**
 * Lightweight interaction logger for v2 evaluation.
 * Records chat interactions, model routing decisions, and response quality signals
 * to a local JSON Lines file for later analysis.
 *
 * Usage: import { logInteraction } from '@/lib/v2-eval/interaction-log';
 *
 * This is opt-in. Set V2_EVAL_LOGGING=true in .env to enable.
 * Writes to workspace/v2-eval/interactions.jsonl
 */

import fs from "node:fs/promises";
import path from "node:path";

const LOG_PATH = path.join(
  process.cwd(),
  "workspace",
  "v2-eval",
  "interactions.jsonl"
);

export type PromptVariantLogged = "full" | "slim" | "compact";

export type FallbackTierLogged = "ollama" | "gemini" | "gateway" | "none";

export type LocalModelClassLogged = "3b" | "7b";

export type InteractionRecord = {
  timestamp: string;
  /** Model id used for inference (after fallback). */
  model: string;
  /** Model id from the chat picker (before fallback). */
  requestedModelId: string;
  userMessageLength: number;
  responseLength: number;
  toolsUsed: string[];
  chatId: string;
  promptVariant: PromptVariantLogged;
  isOllamaLocal: boolean;
  localModelClass?: LocalModelClassLogged | null;
  recentMemoryRowsInPrompt: number;
  recallMemoryInvoked: boolean;
  saveMemoryInvoked: boolean;
  effectiveModelId: string;
  fallbackTier: FallbackTierLogged;
};

export async function logInteraction(record: InteractionRecord): Promise<void> {
  if (process.env.V2_EVAL_LOGGING !== "true") {
    return;
  }

  try {
    const line = `${JSON.stringify(record)}\n`;
    await fs.appendFile(LOG_PATH, line, "utf-8");
  } catch {
    // Silent fail — evaluation logging should never break v1
  }
}
