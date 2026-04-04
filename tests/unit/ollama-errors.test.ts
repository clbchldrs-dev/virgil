import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
  getGatewayErrorStreamMessage,
  getOllamaConnectionErrorCause,
  getOllamaErrorStreamMessage,
  getOllamaErrorUserPayload,
} from "../../lib/ai/providers";
import { VirgilError } from "../../lib/errors";

describe("getGatewayErrorStreamMessage", () => {
  test("detects invalid API key wording", () => {
    const msg = getGatewayErrorStreamMessage(
      new Error("AI Gateway authentication failed: Invalid API key")
    );
    assert.ok(msg);
    assert.ok(msg?.includes("AI_GATEWAY_API_KEY"));
  });

  test("detects AI SDK dev unauthenticated gateway message", () => {
    const err = new Error(
      "Unauthenticated request to AI Gateway.\n\nTo authenticate, set the AI_GATEWAY_API_KEY environment variable."
    );
    err.name = "GatewayAuthenticationError";
    const msg = getGatewayErrorStreamMessage(err);
    assert.ok(msg);
    assert.ok(msg?.includes("AI_GATEWAY_API_KEY"));
  });

  test("detects AI SDK production GatewayError message", () => {
    const err = new Error(
      "Unauthenticated. Configure AI_GATEWAY_API_KEY or use a provider module. Learn more: https://ai-sdk.dev/unauthenticated-ai-gateway"
    );
    err.name = "GatewayError";
    const msg = getGatewayErrorStreamMessage(err);
    assert.ok(msg);
  });

  test("reads nested Error.cause", () => {
    const inner = new Error("Invalid API key");
    const outer = new Error("wrapped");
    outer.cause = inner;
    const msg = getGatewayErrorStreamMessage(outer);
    assert.ok(msg);
  });

  test("returns null for unrelated errors", () => {
    assert.equal(getGatewayErrorStreamMessage(new Error("timeout")), null);
  });
});

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

describe("VirgilError offline:ollama with __FULL__ cause", () => {
  test("exposes full message without reachability prefix", () => {
    const err = new VirgilError(
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
