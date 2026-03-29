import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  collectToolTypeCounts,
  extractTextFromParts,
} from "@/lib/night-review/parts-stats";

describe("night-review parts-stats", () => {
  it("collects tool- prefixed part types", () => {
    const parts = [
      { type: "text", text: "hi" },
      { type: "tool-saveMemory", toolCallId: "1" },
      { type: "tool-saveMemory", toolCallId: "2" },
      { type: "tool-recallMemory", toolCallId: "3" },
    ];
    assert.deepEqual(collectToolTypeCounts(parts), {
      "tool-saveMemory": 2,
      "tool-recallMemory": 1,
    });
  });

  it("extractTextFromParts concatenates text up to maxChars", () => {
    const parts = [
      { type: "text", text: "hello" },
      { type: "text", text: " world" },
    ];
    assert.equal(extractTextFromParts(parts, 100), "hello\nworld");
    assert.equal(extractTextFromParts(parts, 4), "hell");
  });
});
