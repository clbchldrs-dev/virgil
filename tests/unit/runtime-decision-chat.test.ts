import assert from "node:assert/strict";
import { afterEach, describe, test } from "node:test";
import { DEFAULT_CHAT_MODEL, VIRGIL_AUTO_MODEL_ID } from "@/lib/ai/models";
import { resolveChatRuntimeDecision } from "@/lib/ai/runtime-decision/resolve-chat-runtime-decision";

describe("resolveChatRuntimeDecision", () => {
  afterEach(() => {
    process.env.VIRGIL_CHAT_FALLBACK = undefined;
    process.env.VIRGIL_GATEWAY_FALLBACK_OLLAMA = undefined;
  });

  test("keeps allowed selected gateway model", async () => {
    const d = await resolveChatRuntimeDecision({
      selectedChatModel: "deepseek/deepseek-v3.2",
      isAllowedChatModelId: async () => true,
      resolveAutoModel: async () => ({ modelId: DEFAULT_CHAT_MODEL }),
    });
    assert.equal(d.effectiveChatModelId, "deepseek/deepseek-v3.2");
    assert.equal(d.isOllamaLocal, false);
    assert.equal(d.promptVariant, "slim");
    assert.equal(d.chatFallbackEnabled, false);
    assert.deepEqual(d.postOllamaFailureTiers, []);
    assert.ok(d.reasonCodes.includes("chat:model_allowed"));
  });

  test("defaults to DEFAULT_CHAT_MODEL when disallowed", async () => {
    const d = await resolveChatRuntimeDecision({
      selectedChatModel: "ollama/unknown-blocked",
      isAllowedChatModelId: async () => false,
      resolveAutoModel: async () => ({ modelId: DEFAULT_CHAT_MODEL }),
    });
    assert.equal(d.effectiveChatModelId, DEFAULT_CHAT_MODEL);
    assert.ok(d.reasonCodes.includes("chat:model_defaulted_disallowed"));
  });

  test("resolves virgil/auto via resolveAutoModel", async () => {
    const d = await resolveChatRuntimeDecision({
      selectedChatModel: VIRGIL_AUTO_MODEL_ID,
      isAllowedChatModelId: async (id) =>
        id === VIRGIL_AUTO_MODEL_ID || id === "ollama/qwen2.5:3b",
      resolveAutoModel: async () => ({ modelId: "ollama/qwen2.5:3b" }),
    });
    assert.equal(d.effectiveChatModelId, "ollama/qwen2.5:3b");
    assert.equal(d.isOllamaLocal, true);
    assert.equal(d.promptVariant, "slim");
    assert.ok(d.reasonCodes.includes("chat:auto_resolved"));
  });

  test("when auto-resolved model disallowed, falls back to DEFAULT", async () => {
    const d = await resolveChatRuntimeDecision({
      selectedChatModel: VIRGIL_AUTO_MODEL_ID,
      isAllowedChatModelId: async (id) => id === VIRGIL_AUTO_MODEL_ID,
      resolveAutoModel: async () => ({ modelId: "ollama/qwen2.5:3b" }),
    });
    assert.equal(d.effectiveChatModelId, DEFAULT_CHAT_MODEL);
    assert.ok(d.reasonCodes.includes("chat:auto_defaulted_disallowed"));
  });

  test("populates postOllamaFailureTiers when local + chat fallback on", async () => {
    process.env.VIRGIL_CHAT_FALLBACK = "1";
    const { getFallbackTiers } = await import("@/lib/ai/chat-fallback");
    const expected = getFallbackTiers();
    const d = await resolveChatRuntimeDecision({
      selectedChatModel: "ollama/qwen2.5:3b",
      isAllowedChatModelId: async () => true,
      resolveAutoModel: async () => ({ modelId: DEFAULT_CHAT_MODEL }),
    });
    assert.equal(d.chatFallbackEnabled, true);
    assert.deepEqual(d.postOllamaFailureTiers, expected);
  });
});
