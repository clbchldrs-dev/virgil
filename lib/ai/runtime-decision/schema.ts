import type { FallbackTier } from "@/lib/ai/chat-fallback";

/** Bump when changing {@link ChatRuntimePreflightDecision} shape or semantics. */
export const DECISION_SCHEMA_VERSION = "1.0.0" as const;

export type PolicyLaneId = "chat" | "delegation_stub" | "wiki_ops_stub";

export type DecisionPhase = "preflight" | "inflight" | "terminal";

export type DecisionRecordDelivery = "durable" | "best_effort" | "dropped";

export type PromptVariantEffective = "full" | "slim" | "compact";

/** Hard caps for resilient posture; numeric tuning stays in planning until profiled. */
export type RuntimeDecisionCaps = {
  maxTierTransitions: number;
  maxWallClockMsPreflight: number;
  maxStreamRecoveryAttempts: number;
};

export const DEFAULT_RUNTIME_DECISION_CAPS: RuntimeDecisionCaps = {
  maxTierTransitions: 3,
  maxWallClockMsPreflight: 200,
  maxStreamRecoveryAttempts: 3,
};

export type ChatRuntimeDecisionReasonCode =
  | "chat:model_allowed"
  | "chat:model_defaulted_disallowed"
  | "chat:auto_resolved"
  | "chat:auto_defaulted_disallowed";

export type ChatRuntimePreflightDecision = {
  schemaVersion: "1.0.0";
  policyLane: "chat";
  phase: "preflight";
  selectedChatModelId: string;
  effectiveChatModelId: string;
  runtimeModelId: string;
  isOllamaLocal: boolean;
  promptVariant: PromptVariantEffective;
  /** When true, Ollama pre-stream unreachable may escalate to {@link postOllamaFailureTiers}. */
  chatFallbackEnabled: boolean;
  /** Tiers tried after local Ollama is abandoned (empty when {@link chatFallbackEnabled} is false). */
  postOllamaFailureTiers: FallbackTier[];
  /** When false, gateway failures never chain to Ollama (env off or ineligible error class). */
  gatewayMayFallbackToOllamaAfterFailure: boolean;
  caps: RuntimeDecisionCaps;
  reasonCodes: ChatRuntimeDecisionReasonCode[];
};

export function chatRuntimePreflightDecisionToJson(
  d: ChatRuntimePreflightDecision
): Record<string, unknown> {
  return { ...d, postOllamaFailureTiers: [...d.postOllamaFailureTiers] };
}

export function parseChatRuntimePreflightDecisionJson(
  raw: Record<string, unknown>
): ChatRuntimePreflightDecision {
  if (raw.schemaVersion !== DECISION_SCHEMA_VERSION) {
    throw new Error(
      `Unsupported runtime decision schema: ${String(raw.schemaVersion)}`
    );
  }
  const postOllamaFailureTiers = raw.postOllamaFailureTiers;
  if (!Array.isArray(postOllamaFailureTiers)) {
    throw new Error("postOllamaFailureTiers must be an array");
  }
  return {
    schemaVersion: DECISION_SCHEMA_VERSION,
    policyLane: "chat",
    phase: "preflight",
    selectedChatModelId: String(raw.selectedChatModelId),
    effectiveChatModelId: String(raw.effectiveChatModelId),
    runtimeModelId: String(raw.runtimeModelId),
    isOllamaLocal: Boolean(raw.isOllamaLocal),
    promptVariant: raw.promptVariant as PromptVariantEffective,
    chatFallbackEnabled: Boolean(raw.chatFallbackEnabled),
    postOllamaFailureTiers: postOllamaFailureTiers as FallbackTier[],
    gatewayMayFallbackToOllamaAfterFailure: Boolean(
      raw.gatewayMayFallbackToOllamaAfterFailure
    ),
    caps: raw.caps as RuntimeDecisionCaps,
    reasonCodes: raw.reasonCodes as ChatRuntimeDecisionReasonCode[],
  };
}
