import {
  getFallbackTiers,
  isChatFallbackEnabled,
  isGatewayFallbackToOllamaEnabled,
} from "@/lib/ai/chat-fallback";
import type { ClientRoutingHints } from "@/lib/ai/model-routing";
import {
  DEFAULT_CHAT_MODEL,
  getChatModelWithLocalFallback,
  isLocalModel,
  resolveRuntimeModelId,
  VIRGIL_AUTO_MODEL_ID,
} from "@/lib/ai/models";
import {
  type ChatRuntimeDecisionReasonCode,
  type ChatRuntimePreflightDecision,
  DECISION_SCHEMA_VERSION,
  DEFAULT_RUNTIME_DECISION_CAPS,
  type PromptVariantEffective,
} from "@/lib/ai/runtime-decision/schema";

export type ResolveChatRuntimeDecisionInput = {
  selectedChatModel: string;
  isAllowedChatModelId: (modelId: string) => Promise<boolean>;
  resolveAutoModel: (
    hints: ClientRoutingHints | undefined
  ) => Promise<{ modelId: string }>;
  clientRoutingHints?: ClientRoutingHints;
};

function dedupeReasons(
  codes: ChatRuntimeDecisionReasonCode[]
): ChatRuntimeDecisionReasonCode[] {
  return [...new Set(codes)];
}

/**
 * Preflight runtime decision for the **chat** policy lane: effective model id,
 * prompt shape, and fallback **intent** aligned with `app/(chat)/api/chat/route.ts`
 * (without calling Ollama — reachability stays in the route until seam cutover).
 */
export async function resolveChatRuntimeDecision(
  input: ResolveChatRuntimeDecisionInput
): Promise<ChatRuntimePreflightDecision> {
  const reasons: ChatRuntimeDecisionReasonCode[] = [];

  const selectedAllowed = await input.isAllowedChatModelId(
    input.selectedChatModel
  );
  let effectiveChatModelId = selectedAllowed
    ? input.selectedChatModel
    : DEFAULT_CHAT_MODEL;
  if (selectedAllowed) {
    reasons.push("chat:model_allowed");
  } else {
    reasons.push("chat:model_defaulted_disallowed");
  }

  if (effectiveChatModelId === VIRGIL_AUTO_MODEL_ID) {
    const { modelId } = await input.resolveAutoModel(input.clientRoutingHints);
    const autoAllowed = await input.isAllowedChatModelId(modelId);
    if (autoAllowed) {
      effectiveChatModelId = modelId;
      reasons.push("chat:auto_resolved");
    } else {
      effectiveChatModelId = DEFAULT_CHAT_MODEL;
      reasons.push("chat:auto_defaulted_disallowed");
      if (!reasons.includes("chat:model_defaulted_disallowed")) {
        reasons.push("chat:model_defaulted_disallowed");
      }
    }
  }

  const modelConfig = getChatModelWithLocalFallback(effectiveChatModelId);
  const isOllamaLocal = isLocalModel(effectiveChatModelId);
  const promptVariant = (modelConfig?.promptVariant ??
    "slim") as PromptVariantEffective;
  const chatFallbackEnabled = isOllamaLocal && isChatFallbackEnabled();
  const postOllamaFailureTiers = chatFallbackEnabled ? getFallbackTiers() : [];
  const gatewayMayFallbackToOllamaAfterFailure =
    !isOllamaLocal && isGatewayFallbackToOllamaEnabled();

  return {
    schemaVersion: DECISION_SCHEMA_VERSION,
    policyLane: "chat",
    phase: "preflight",
    selectedChatModelId: input.selectedChatModel,
    effectiveChatModelId,
    runtimeModelId: resolveRuntimeModelId(effectiveChatModelId),
    isOllamaLocal,
    promptVariant,
    chatFallbackEnabled,
    postOllamaFailureTiers,
    gatewayMayFallbackToOllamaAfterFailure,
    caps: DEFAULT_RUNTIME_DECISION_CAPS,
    reasonCodes: dedupeReasons(reasons),
  };
}
