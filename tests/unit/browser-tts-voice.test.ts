import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { pickPreferredVoice } from "../../lib/browser-tts-voice";

function voice(partial: {
  name: string;
  lang: string;
  voiceURI: string;
}): SpeechSynthesisVoice {
  return partial as SpeechSynthesisVoice;
}

describe("pickPreferredVoice", () => {
  it("prefers an English male-labelled voice over default female en-US", () => {
    const chosen = pickPreferredVoice([
      voice({
        name: "Samantha",
        lang: "en-US",
        voiceURI: "com.apple.speech.synthesis.voice.Samantha",
      }),
      voice({
        name: "Google US English Male",
        lang: "en-US",
        voiceURI: "Google US English Male",
      }),
    ]);
    assert.ok(chosen);
    assert.match(chosen.name, /male/i);
  });

  it("prefers Microsoft David over Zira when both are en-US", () => {
    const chosen = pickPreferredVoice([
      voice({
        name: "Microsoft Zira - English (United States)",
        lang: "en-US",
        voiceURI: "Microsoft Zira - English (United States)",
      }),
      voice({
        name: "Microsoft David - English (United States)",
        lang: "en-US",
        voiceURI: "Microsoft David - English (United States)",
      }),
    ]);
    assert.ok(chosen);
    assert.match(chosen.name, /David/i);
  });

  it("selects macOS Alex when paired with Samantha", () => {
    const chosen = pickPreferredVoice([
      voice({
        name: "Samantha",
        lang: "en-US",
        voiceURI: "com.apple.speech.synthesis.voice.Samantha",
      }),
      voice({
        name: "Alex",
        lang: "en-US",
        voiceURI: "com.apple.speech.synthesis.voice.Alex",
      }),
    ]);
    assert.ok(chosen);
    assert.equal(chosen.name, "Alex");
  });

  it("falls back to first non-female English voice when no male hint exists", () => {
    const chosen = pickPreferredVoice([
      voice({
        name: "Google UK English Female",
        lang: "en-GB",
        voiceURI: "Google UK English Female",
      }),
      voice({
        name: "Google UK English",
        lang: "en-GB",
        voiceURI: "Google UK English",
      }),
    ]);
    assert.ok(chosen);
    assert.equal(chosen.name, "Google UK English");
  });
});
