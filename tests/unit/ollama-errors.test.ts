import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
  getOllamaConnectionErrorCause,
  getOllamaErrorStreamMessage,
  getOllamaErrorUserPayload,
} from "../../lib/ai/providers";
import { ChatbotError } from "../../lib/errors";

describe("getOllamaConnectionErrorCause", () => {
  test("detects unreachable host", () => {
    const cause = getOllamaConnectionErrorCause(
      new TypeError("fetch failed"),
      "http://127.0.0.1:11434"
    );
    assert.ok(cause?.includes("not reachable"));
  });
});

describe("getOllamaErrorUserPayload", () => {
  test("returns connection wording for ECONNREFUSED-style errors", () => {
    const p = getOllamaErrorUserPayload(
      new Error("fetch failed"),
      "http://127.0.0.1:11434"
    );
    assert.ok(p?.includes("not reachable"));
    assert.ok(!p?.startsWith("__FULL__:"));
  });

  test("uses __FULL__ for missing model messages", () => {
    const p = getOllamaErrorUserPayload(
      new Error("model 'foo' not found"),
      "http://127.0.0.1:11434"
    );
    assert.ok(p?.startsWith("__FULL__:"));
    assert.ok(p?.includes("ollama list"));
  });

  test("uses __FULL__ for 404 status in message", () => {
    const p = getOllamaErrorUserPayload(
      new Error("status code: 404"),
      "http://127.0.0.1:11434"
    );
    assert.ok(p?.startsWith("__FULL__:"));
  });

  test("uses __FULL__ for timeout", () => {
    const p = getOllamaErrorUserPayload(
      new Error("request timeout"),
      "http://127.0.0.1:11434"
    );
    assert.ok(p?.startsWith("__FULL__:"));
    assert.ok(p?.toLowerCase().includes("responding"));
  });
});

describe("ChatbotError offline:ollama with __FULL__ cause", () => {
  test("exposes full message without reachability prefix", () => {
    const err = new ChatbotError(
      "offline:ollama",
      "__FULL__:Model missing — run ollama pull."
    );
    assert.equal(err.message, "Model missing — run ollama pull.");
  });
});

describe("getOllamaErrorStreamMessage", () => {
  test("strips __FULL__ for streams", () => {
    const msg = getOllamaErrorStreamMessage(
      new Error("model 'x' not found"),
      "http://127.0.0.1:11434"
    );
    assert.ok(msg);
    assert.ok(!msg?.includes("__FULL__"));
    assert.ok(msg?.includes("ollama list"));
  });

  test("adds start hint for connection errors", () => {
    const msg = getOllamaErrorStreamMessage(
      new TypeError("fetch failed"),
      "http://127.0.0.1:11434"
    );
    assert.ok(msg?.includes("Start Ollama"));
  });
});
