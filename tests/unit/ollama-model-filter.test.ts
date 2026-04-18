import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { chatModels, VIRGIL_AUTO_MODEL_ID } from "@/lib/ai/models";
import { filterChatModelsByAvailableOllamaTags } from "@/lib/ai/ollama-discovery";

describe("filterChatModelsByAvailableOllamaTags", () => {
  it("hides all local models when Ollama reports no tags", () => {
    const out = filterChatModelsByAvailableOllamaTags(chatModels, []);
    const local = out.filter((m) => m.id.startsWith("ollama/"));
    assert.equal(local.length, 0);
    assert.ok(out.some((m) => m.id === VIRGIL_AUTO_MODEL_ID));
    assert.ok(out.some((m) => m.id === "deepseek/deepseek-v3.2"));
  });

  it("keeps only locals whose runtime tag exists in Ollama", () => {
    const out = filterChatModelsByAvailableOllamaTags(chatModels, [
      "qwen2.5:3b",
      "qwen2.5:7b-instruct",
    ]);
    assert.ok(out.some((m) => m.id === "ollama/qwen2.5:3b"));
    assert.ok(out.some((m) => m.id === "ollama/qwen2.5:7b-lean"));
    assert.equal(
      out.some((m) => m.id === "ollama/qwen2.5:7b-review"),
      true
    );
  });

  it("drops locals when required weight is missing", () => {
    const out = filterChatModelsByAvailableOllamaTags(chatModels, [
      "qwen2.5:3b",
    ]);
    assert.equal(
      out.some((m) => m.id === "ollama/qwen2.5:7b-instruct"),
      false
    );
  });
});
