import assert from "node:assert/strict";
import { afterEach, describe, test } from "node:test";
import {
  runStableChatGatewayPolicyChecks,
  shouldAttemptOllamaAfterGatewayFailure,
} from "@/lib/ai/runtime-decision/gateway-fallback-policy";

describe("gateway fallback policy (stable rule table)", () => {
  afterEach(() => {
    process.env.VIRGIL_GATEWAY_FALLBACK_OLLAMA = undefined;
  });

  test("never attempts Ollama after gateway auth failure when flag is on", () => {
    process.env.VIRGIL_GATEWAY_FALLBACK_OLLAMA = "1";
    const authErr = new Error(
      "AI Gateway authentication failed: invalid API key"
    );
    assert.equal(shouldAttemptOllamaAfterGatewayFailure(true, authErr), false);
    const checks = runStableChatGatewayPolicyChecks({
      gatewayFallbackToOllamaEnabled: true,
      sampleError: authErr,
    });
    assert.ok(checks.every((c) => c.ok));
  });

  test("may attempt Ollama after rate-limit style gateway failure when flag is on", () => {
    process.env.VIRGIL_GATEWAY_FALLBACK_OLLAMA = "1";
    const rateErr = new Error("rate limit exceeded");
    assert.equal(shouldAttemptOllamaAfterGatewayFailure(true, rateErr), true);
    const checks = runStableChatGatewayPolicyChecks({
      gatewayFallbackToOllamaEnabled: true,
      sampleError: rateErr,
    });
    assert.ok(checks.every((c) => c.ok));
  });

  test("never attempts Ollama when gateway fallback flag is off", () => {
    const rateErr = new Error("rate limit exceeded");
    assert.equal(shouldAttemptOllamaAfterGatewayFailure(false, rateErr), false);
  });
});
