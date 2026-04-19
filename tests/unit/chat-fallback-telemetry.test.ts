import assert from "node:assert/strict";
import test from "node:test";
import {
  logChatPathTelemetryEvent,
  normalizeChatTelemetryErrorCode,
} from "@/lib/reliability/chat-path-telemetry";

test("normalizes common error classes", () => {
  assert.equal(
    normalizeChatTelemetryErrorCode(
      new Error("Request failed with status code: 429")
    ),
    "rate_limited"
  );
  assert.equal(
    normalizeChatTelemetryErrorCode(new Error("model 'qwen' not found")),
    "model_not_found"
  );
  assert.equal(
    normalizeChatTelemetryErrorCode(
      new Error("connect ECONNREFUSED 127.0.0.1")
    ),
    "unreachable"
  );
});

test("writes telemetry event with derived requested/effective paths", async () => {
  const inserted: Record<string, unknown>[] = [];

  await logChatPathTelemetryEvent({
    userId: "user-1",
    chatId: "chat-1",
    requestedModelId: "ollama/qwen2.5:7b-instruct",
    effectiveModelId: "google/gemini-2.5-flash",
    fallbackTier: "gemini",
    outcome: "completed",
    insertFn: (input) => {
      inserted.push(input as Record<string, unknown>);
      return Promise.resolve();
    },
  });

  assert.equal(inserted.length, 1);
  assert.equal(inserted[0]?.requestedPath, "ollama");
  assert.equal(inserted[0]?.effectivePath, "gateway");
  assert.equal(inserted[0]?.fallbackTier, "gemini");
});
