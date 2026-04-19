import fs from "node:fs/promises";
import path from "node:path";

import type { FallbackTier } from "@/lib/ai/chat-fallback";
import type {
  ChatRuntimePreflightDecision,
  PromptVariantEffective,
} from "@/lib/ai/runtime-decision/schema";

/** When true, the chat route uses `resolveChatRuntimeDecision` for effective model + local flag (IU5). */
export function isRuntimeDecisionSeamAuthoritativeEnabled(): boolean {
  const v =
    process.env.VIRGIL_RUNTIME_DECISION_SEAM_AUTHORITATIVE?.trim().toLowerCase();
  return v === "1" || v === "true" || v === "yes";
}

/** When true, compute the runtime decision seam alongside legacy routing and log divergences only (IU4). Ignored when authoritative is on (no duplicate work). */
export function isRuntimeDecisionSeamShadowEnabled(): boolean {
  if (isRuntimeDecisionSeamAuthoritativeEnabled()) {
    return false;
  }
  const v =
    process.env.VIRGIL_RUNTIME_DECISION_SEAM_SHADOW?.trim().toLowerCase();
  return v === "1" || v === "true" || v === "yes";
}

export type LegacyChatRuntimeSnapshot = {
  effectiveChatModelId: string;
  isOllamaLocal: boolean;
  promptVariant: PromptVariantEffective;
  chatFallbackEnabled: boolean;
  postOllamaFailureTiers: FallbackTier[];
  gatewayMayFallbackToOllamaAfterFailure: boolean;
};

function tiersEqual(a: FallbackTier[], b: FallbackTier[]): boolean {
  if (a.length !== b.length) {
    return false;
  }
  return a.every((t, i) => t === b[i]);
}

/** True when the seam preflight disagrees with the legacy route snapshot. */
export function chatRuntimeDecisionShadowDiffers(args: {
  seam: ChatRuntimePreflightDecision;
  legacy: LegacyChatRuntimeSnapshot;
}): boolean {
  const { seam, legacy } = args;
  return (
    seam.effectiveChatModelId !== legacy.effectiveChatModelId ||
    seam.isOllamaLocal !== legacy.isOllamaLocal ||
    seam.promptVariant !== legacy.promptVariant ||
    seam.chatFallbackEnabled !== legacy.chatFallbackEnabled ||
    !tiersEqual(seam.postOllamaFailureTiers, legacy.postOllamaFailureTiers) ||
    seam.gatewayMayFallbackToOllamaAfterFailure !==
      legacy.gatewayMayFallbackToOllamaAfterFailure
  );
}

export type ShadowSeamDivergenceRecord = {
  ts: string;
  chatId: string;
  selectedChatModelId: string;
  legacy: LegacyChatRuntimeSnapshot;
  seam: ChatRuntimePreflightDecision;
};

const SHADOW_LOG = path.join(
  process.cwd(),
  "workspace",
  "v2-eval",
  "shadow-seam-divergence.jsonl"
);

/** Best-effort NDJSON line for operators (same spirit as `logDecisionTrace`). */
export async function appendShadowSeamDivergenceRecord(
  record: ShadowSeamDivergenceRecord
): Promise<void> {
  try {
    const line = `${JSON.stringify(record)}\n`;
    await fs.mkdir(path.dirname(SHADOW_LOG), { recursive: true });
    await fs.appendFile(SHADOW_LOG, line, "utf-8");
  } catch {
    /* shadow logging must never affect chat */
  }
}
