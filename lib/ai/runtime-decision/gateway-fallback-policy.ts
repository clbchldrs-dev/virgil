import {
  isGatewayAuthFailureError,
  isGatewayFallbackEligibleError,
} from "@/lib/ai/chat-fallback";

/**
 * Stable policy: never treat gateway **auth** failures as transport errors that
 * justify chaining to Ollama, even when `VIRGIL_GATEWAY_FALLBACK_OLLAMA` is on.
 * (Matches `isGatewayFallbackEligibleError`, which already excludes auth.)
 */
export function shouldAttemptOllamaAfterGatewayFailure(
  gatewayFallbackToOllamaEnabled: boolean,
  error: unknown
): boolean {
  if (!gatewayFallbackToOllamaEnabled) {
    return false;
  }
  if (isGatewayAuthFailureError(error)) {
    return false;
  }
  return isGatewayFallbackEligibleError(error);
}

export type StableChatPolicyRuleId =
  | "gateway-auth-never-masks-as-transport"
  | "gateway-fallback-eligibility";

export type StablePolicyCheckResult =
  | { ok: true; ruleId: StableChatPolicyRuleId }
  | { ok: false; ruleId: StableChatPolicyRuleId; detail: string };

/**
 * Ordered stable checks (IU3 rule table) — invariant tests on gateway↔Ollama policy.
 */
export function runStableChatGatewayPolicyChecks(args: {
  gatewayFallbackToOllamaEnabled: boolean;
  /** Hypothetical error after a gateway `streamText` failure. */
  sampleError: unknown;
}): StablePolicyCheckResult[] {
  const results: StablePolicyCheckResult[] = [];

  const auth = isGatewayAuthFailureError(args.sampleError);
  const eligible = isGatewayFallbackEligibleError(args.sampleError);
  if (auth && eligible) {
    results.push({
      ok: false,
      ruleId: "gateway-auth-never-masks-as-transport",
      detail: "auth failure must not be gateway-fallback-eligible",
    });
  } else {
    results.push({
      ok: true,
      ruleId: "gateway-auth-never-masks-as-transport",
    });
  }

  const may = shouldAttemptOllamaAfterGatewayFailure(
    args.gatewayFallbackToOllamaEnabled,
    args.sampleError
  );
  const expected = args.gatewayFallbackToOllamaEnabled && eligible && !auth;
  if (may === expected) {
    results.push({
      ok: true,
      ruleId: "gateway-fallback-eligibility",
    });
  } else {
    results.push({
      ok: false,
      ruleId: "gateway-fallback-eligibility",
      detail: `expected mayTryOllama=${expected}, got ${may}`,
    });
  }

  return results;
}
