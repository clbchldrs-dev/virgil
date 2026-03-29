import assert from "node:assert/strict";
import test from "node:test";
import {
  describeChatError,
  isLikelyLocalModelErrorText,
  shouldEmphasizeLocalModelError,
} from "@/lib/chat-error-display";
import { ChatbotError } from "@/lib/errors";

test("describeChatError uses ChatbotError message", () => {
  const e = new ChatbotError(
    "offline:ollama",
    "Ollama is not reachable at http://127.0.0.1:11434"
  );
  assert.equal(describeChatError(e).includes("Ollama"), true);
});

test("isLikelyLocalModelErrorText detects Ollama strings", () => {
  assert.equal(isLikelyLocalModelErrorText("Ollama stopped responding"), true);
  assert.equal(isLikelyLocalModelErrorText("Network error"), false);
});

test("shouldEmphasizeLocalModelError for local model id", () => {
  assert.equal(
    shouldEmphasizeLocalModelError(new Error("x"), "ollama/qwen2.5:3b"),
    true
  );
});
