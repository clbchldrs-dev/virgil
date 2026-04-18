import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildAlexaSpeechResponse } from "@/lib/channels/alexa/response";
import {
  alexaRequestEnvelopeSchema,
  extractCaptureText,
} from "@/lib/channels/alexa/schema";
import { isVirgilAlexaEnabled } from "@/lib/virgil/integrations";

describe("alexa request schema", () => {
  it("accepts a valid capture intent envelope", () => {
    const parsed = alexaRequestEnvelopeSchema.safeParse({
      request: {
        type: "IntentRequest",
        intent: {
          name: "CaptureIntent",
          slots: {
            note: {
              name: "note",
              value: "Buy dog food",
            },
          },
        },
      },
      session: {
        sessionId: "session-123",
        user: {
          userId: "amzn1.ask.account.user",
        },
      },
    });

    assert.equal(parsed.success, true);
    if (parsed.success) {
      assert.equal(extractCaptureText(parsed.data), "Buy dog food");
    }
  });

  it("rejects envelope without request", () => {
    const parsed = alexaRequestEnvelopeSchema.safeParse({
      session: {
        sessionId: "session-123",
      },
    });
    assert.equal(parsed.success, false);
  });

  it("extracts capture text from fallback slot names", () => {
    const parsed = alexaRequestEnvelopeSchema.parse({
      request: {
        type: "IntentRequest",
        intent: {
          name: "CaptureIntent",
          slots: {
            arbitrary: {
              name: "arbitrary",
              value: "Remember the sprint demo Friday",
            },
          },
        },
      },
    });

    assert.equal(extractCaptureText(parsed), "Remember the sprint demo Friday");
  });
});

describe("alexa speech response", () => {
  it("builds plain-text alexa response and sanitizes markdown characters", () => {
    const response = buildAlexaSpeechResponse({
      speech: "**Saved** _note_",
      reprompt: "Try `capture note`",
    });

    assert.equal(response.version, "1.0");
    assert.equal(response.response.outputSpeech.type, "PlainText");
    assert.equal(response.response.outputSpeech.text, "Saved note");
    assert.equal(
      response.response.reprompt?.outputSpeech.text,
      "Try capture note"
    );
    assert.equal(response.response.shouldEndSession, false);
  });
});

describe("isVirgilAlexaEnabled", () => {
  it("is disabled unless VIRGIL_ALEXA_ENABLED=1", () => {
    const prev = process.env.VIRGIL_ALEXA_ENABLED;
    try {
      Reflect.deleteProperty(process.env, "VIRGIL_ALEXA_ENABLED");
      assert.equal(isVirgilAlexaEnabled(), false);
      process.env.VIRGIL_ALEXA_ENABLED = "1";
      assert.equal(isVirgilAlexaEnabled(), true);
    } finally {
      if (prev === undefined) {
        Reflect.deleteProperty(process.env, "VIRGIL_ALEXA_ENABLED");
      } else {
        process.env.VIRGIL_ALEXA_ENABLED = prev;
      }
    }
  });
});
