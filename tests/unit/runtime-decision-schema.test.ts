import assert from "node:assert/strict";
import { describe, test } from "node:test";
import type { FallbackTier } from "@/lib/ai/chat-fallback";
import {
  type ChatRuntimePreflightDecision,
  chatRuntimePreflightDecisionToJson,
  DECISION_SCHEMA_VERSION,
  parseChatRuntimePreflightDecisionJson,
} from "@/lib/ai/runtime-decision/schema";

describe("runtime decision schema", () => {
  test("round-trips through JSON-compatible object", () => {
    const original: ChatRuntimePreflightDecision = {
      schemaVersion: DECISION_SCHEMA_VERSION,
      policyLane: "chat",
      phase: "preflight",
      selectedChatModelId: "deepseek/deepseek-v3.2",
      effectiveChatModelId: "deepseek/deepseek-v3.2",
      runtimeModelId: "deepseek/deepseek-v3.2",
      isOllamaLocal: false,
      promptVariant: "full",
      chatFallbackEnabled: false,
      postOllamaFailureTiers: [] as FallbackTier[],
      gatewayMayFallbackToOllamaAfterFailure: false,
      caps: {
        maxTierTransitions: 3,
        maxWallClockMsPreflight: 200,
        maxStreamRecoveryAttempts: 3,
      },
      reasonCodes: ["chat:model_allowed"],
    };
    const json = chatRuntimePreflightDecisionToJson(original);
    const back = parseChatRuntimePreflightDecisionJson(json);
    assert.deepEqual(back, original);
  });

  test("rejects unknown schema version", () => {
    assert.throws(
      () =>
        parseChatRuntimePreflightDecisionJson({
          schemaVersion: "0.0.0",
          policyLane: "chat",
        }),
      /Unsupported runtime decision schema/
    );
  });
});
