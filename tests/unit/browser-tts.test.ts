import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { prepareTextForSpeech } from "../../lib/browser-tts";

describe("prepareTextForSpeech", () => {
  it("strips fenced code blocks", () => {
    const out = prepareTextForSpeech("Hello\n```ts\nconst x = 1\n```\nWorld");
    assert.equal(out, "Hello World");
  });

  it("keeps inline code words without backticks", () => {
    assert.equal(
      prepareTextForSpeech("Use the `npm` tool."),
      "Use the npm tool."
    );
  });

  it("uses link text only for markdown links", () => {
    assert.equal(
      prepareTextForSpeech("See [docs](https://example.com/a) for more."),
      "See docs for more."
    );
  });

  it("removes heading markers", () => {
    assert.equal(prepareTextForSpeech("## Section title"), "Section title");
  });

  it("removes bold markers", () => {
    assert.equal(
      prepareTextForSpeech("This is **important**."),
      "This is important."
    );
  });

  it("returns empty when only whitespace remains", () => {
    assert.equal(prepareTextForSpeech("   "), "");
  });
});
