export {
  shouldAttemptOllamaAfterGatewayFailure,
  runStableChatGatewayPolicyChecks,
} from "@/lib/ai/runtime-decision/gateway-fallback-policy";
export { resolveChatRuntimeDecision } from "@/lib/ai/runtime-decision/resolve-chat-runtime-decision";
export type { ResolveChatRuntimeDecisionInput } from "@/lib/ai/runtime-decision/resolve-chat-runtime-decision";
export {
  chatRuntimePreflightDecisionToJson,
  DECISION_SCHEMA_VERSION,
  DEFAULT_RUNTIME_DECISION_CAPS,
  parseChatRuntimePreflightDecisionJson,
} from "@/lib/ai/runtime-decision/schema";
export type {
  ChatRuntimeDecisionReasonCode,
  ChatRuntimePreflightDecision,
  DecisionPhase,
  DecisionRecordDelivery,
  PolicyLaneId,
  PromptVariantEffective,
  RuntimeDecisionCaps,
} from "@/lib/ai/runtime-decision/schema";
