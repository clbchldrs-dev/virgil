export {
  runStableChatGatewayPolicyChecks,
  shouldAttemptOllamaAfterGatewayFailure,
} from "@/lib/ai/runtime-decision/gateway-fallback-policy";
export type { ResolveChatRuntimeDecisionInput } from "@/lib/ai/runtime-decision/resolve-chat-runtime-decision";
export { resolveChatRuntimeDecision } from "@/lib/ai/runtime-decision/resolve-chat-runtime-decision";
export type {
  ChatRuntimeDecisionReasonCode,
  ChatRuntimePreflightDecision,
  DecisionPhase,
  DecisionRecordDelivery,
  PolicyLaneId,
  PromptVariantEffective,
  RuntimeDecisionCaps,
} from "@/lib/ai/runtime-decision/schema";
export {
  chatRuntimePreflightDecisionToJson,
  DECISION_SCHEMA_VERSION,
  DEFAULT_RUNTIME_DECISION_CAPS,
  parseChatRuntimePreflightDecisionJson,
} from "@/lib/ai/runtime-decision/schema";
export type {
  LegacyChatRuntimeSnapshot,
  ShadowSeamDivergenceRecord,
} from "@/lib/ai/runtime-decision/shadow";
export {
  appendShadowSeamDivergenceRecord,
  chatRuntimeDecisionShadowDiffers,
  isRuntimeDecisionSeamAuthoritativeEnabled,
  isRuntimeDecisionSeamShadowEnabled,
} from "@/lib/ai/runtime-decision/shadow";
