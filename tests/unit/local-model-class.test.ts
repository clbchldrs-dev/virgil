import assert from "node:assert/strict";
import test from "node:test";

import {
  getResolvedLocalModelClass,
  inferLocalModelClassFromOllamaTag,
} from "../../lib/ai/models";

test("inferLocalModelClassFromOllamaTag buckets parameter sizes", () => {
  assert.equal(inferLocalModelClassFromOllamaTag("qwen2.5:3b"), "3b");
  assert.equal(inferLocalModelClassFromOllamaTag("phi3:3.8b"), "3b");
  assert.equal(inferLocalModelClassFromOllamaTag("llama3.2:3b-instruct"), "3b");
  assert.equal(inferLocalModelClassFromOllamaTag("tinyllama:1.1b"), "3b");
  assert.equal(inferLocalModelClassFromOllamaTag("qwen2.5:7b-instruct"), "7b");
  assert.equal(inferLocalModelClassFromOllamaTag("llama3.1:8b"), "7b");
  assert.equal(inferLocalModelClassFromOllamaTag("unknown-tag"), "3b");
});

test("getResolvedLocalModelClass uses explicit ChatModel.localModelClass when set", async () => {
  const { chatModels } = await import("../../lib/ai/models");
  const qwen3b = chatModels.find((m) => m.id === "ollama/qwen2.5:3b");
  const qwen7b = chatModels.find((m) => m.id === "ollama/qwen2.5:7b-instruct");
  assert.ok(qwen3b);
  assert.ok(qwen7b);
  assert.equal(getResolvedLocalModelClass("ollama/qwen2.5:3b", qwen3b), "3b");
  assert.equal(
    getResolvedLocalModelClass("ollama/qwen2.5:7b-instruct", qwen7b),
    "7b"
  );
});

test("getResolvedLocalModelClass infers from tag when synthetic / discovered", () => {
  assert.equal(
    getResolvedLocalModelClass("ollama/mistral:7b", undefined),
    "7b"
  );
  assert.equal(getResolvedLocalModelClass("ollama/gemma2:2b", undefined), "3b");
  assert.equal(
    getResolvedLocalModelClass("moonshotai/kimi-k2-0905", undefined),
    "7b"
  );
});
