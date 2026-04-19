import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { getSpeechRecognitionConstructor } from "../../lib/browser-stt-input";

describe("getSpeechRecognitionConstructor", () => {
  it("returns null when window is undefined (SSR / Node)", () => {
    assert.equal(getSpeechRecognitionConstructor(), null);
  });
});
