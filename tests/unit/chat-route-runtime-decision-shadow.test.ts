import assert from "node:assert/strict";
import { afterEach, describe, test } from "node:test";
import type { ChatRuntimePreflightDecision } from "@/lib/ai/runtime-decision/schema";
import { DECISION_SCHEMA_VERSION } from "@/lib/ai/runtime-decision/schema";
import {
  chatRuntimeDecisionShadowDiffers,
  isRuntimeDecisionSeamAuthoritativeEnabled,
  isRuntimeDecisionSeamShadowEnabled,
} from "@/lib/ai/runtime-decision/shadow";

function baseSeam(
  overrides: Partial<ChatRuntimePreflightDecision> = {}
): ChatRuntimePreflightDecision {
  return {
    schemaVersion: DECISION_SCHEMA_VERSION,
    policyLane: "chat",
    phase: "preflight",
    selectedChatModelId: "deepseek/deepseek-v3.2",
    effectiveChatModelId: "deepseek/deepseek-v3.2",
    runtimeModelId: "deepseek/deepseek-v3.2",
    isOllamaLocal: false,
    promptVariant: "slim",
    chatFallbackEnabled: false,
    postOllamaFailureTiers: [],
    gatewayMayFallbackToOllamaAfterFailure: false,
    caps: {
      maxTierTransitions: 3,
      maxWallClockMsPreflight: 200,
      maxStreamRecoveryAttempts: 3,
    },
    reasonCodes: ["chat:model_allowed"],
    ...overrides,
  };
}

describe("runtime decision seam shadow", () => {
  afterEach(() => {
    delete process.env.VIRGIL_RUNTIME_DECISION_SEAM_SHADOW;
    delete process.env.VIRGIL_RUNTIME_DECISION_SEAM_AUTHORITATIVE;
  });

  test("isRuntimeDecisionSeamShadowEnabled reads env", () => {
    assert.equal(isRuntimeDecisionSeamShadowEnabled(), false);
    process.env.VIRGIL_RUNTIME_DECISION_SEAM_SHADOW = "1";
    assert.equal(isRuntimeDecisionSeamShadowEnabled(), true);
  });

  test("authoritative mode disables shadow flag", () => {
    process.env.VIRGIL_RUNTIME_DECISION_SEAM_SHADOW = "1";
    process.env.VIRGIL_RUNTIME_DECISION_SEAM_AUTHORITATIVE = "1";
    assert.equal(isRuntimeDecisionSeamAuthoritativeEnabled(), true);
    assert.equal(isRuntimeDecisionSeamShadowEnabled(), false);
  });

  test("isRuntimeDecisionSeamAuthoritativeEnabled reads env", () => {
    assert.equal(isRuntimeDecisionSeamAuthoritativeEnabled(), false);
    process.env.VIRGIL_RUNTIME_DECISION_SEAM_AUTHORITATIVE = "true";
    assert.equal(isRuntimeDecisionSeamAuthoritativeEnabled(), true);
  });

  test("chatRuntimeDecisionShadowDiffers is false when legacy matches seam", () => {
    const seam = baseSeam();
    assert.equal(
      chatRuntimeDecisionShadowDiffers({
        seam,
        legacy: {
          effectiveChatModelId: seam.effectiveChatModelId,
          isOllamaLocal: seam.isOllamaLocal,
          promptVariant: seam.promptVariant,
          chatFallbackEnabled: seam.chatFallbackEnabled,
          postOllamaFailureTiers: [...seam.postOllamaFailureTiers],
          gatewayMayFallbackToOllamaAfterFailure:
            seam.gatewayMayFallbackToOllamaAfterFailure,
        },
      }),
      false
    );
  });

  test("chatRuntimeDecisionShadowDiffers when effective model differs", () => {
    const seam = baseSeam({
      effectiveChatModelId: "google/gemini-2.5-flash-lite",
    });
    assert.equal(
      chatRuntimeDecisionShadowDiffers({
        seam,
        legacy: {
          effectiveChatModelId: "deepseek/deepseek-v3.2",
          isOllamaLocal: false,
          promptVariant: "slim",
          chatFallbackEnabled: false,
          postOllamaFailureTiers: [],
          gatewayMayFallbackToOllamaAfterFailure: false,
        },
      }),
      true
    );
  });

  test("chatRuntimeDecisionShadowDiffers when tier lists differ", () => {
    const seam = baseSeam({
      postOllamaFailureTiers: ["gateway"],
    });
    assert.equal(
      chatRuntimeDecisionShadowDiffers({
        seam,
        legacy: {
          effectiveChatModelId: seam.effectiveChatModelId,
          isOllamaLocal: seam.isOllamaLocal,
          promptVariant: seam.promptVariant,
          chatFallbackEnabled: seam.chatFallbackEnabled,
          postOllamaFailureTiers: ["gemini", "gateway"],
          gatewayMayFallbackToOllamaAfterFailure:
            seam.gatewayMayFallbackToOllamaAfterFailure,
        },
      }),
      true
    );
  });
});
