import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { handleAlexaPost } from "@/lib/channels/alexa/route-handler";

function extractSpeechText(payload: unknown): string {
  if (
    typeof payload === "object" &&
    payload !== null &&
    "response" in payload &&
    typeof payload.response === "object" &&
    payload.response !== null &&
    "outputSpeech" in payload.response &&
    typeof payload.response.outputSpeech === "object" &&
    payload.response.outputSpeech !== null &&
    "text" in payload.response.outputSpeech &&
    typeof payload.response.outputSpeech.text === "string"
  ) {
    return payload.response.outputSpeech.text;
  }
  return "";
}

describe("handleAlexaPost", () => {
  it("returns 403 when feature is disabled", async () => {
    const response = await handleAlexaPost(
      new Request("http://localhost/api/channels/alexa", { method: "POST" }),
      {
        isEnabled: () => false,
        getSecret: () => "secret",
        getUserId: () => "user-1",
        persist: async () => ({ id: "memory-1" }),
        getRecent: async () => [],
        nowMs: () => 0,
      }
    );

    assert.equal(response.status, 403);
    assert.deepEqual(await response.json(), { error: "alexa_disabled" });
  });

  it("returns 401 when bearer secret is invalid", async () => {
    const response = await handleAlexaPost(
      new Request("http://localhost/api/channels/alexa", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ request: { type: "LaunchRequest" } }),
      }),
      {
        isEnabled: () => true,
        getSecret: () => "secret",
        getUserId: () => "user-1",
        persist: async () => ({ id: "memory-1" }),
        getRecent: async () => [],
        nowMs: () => 0,
      }
    );

    assert.equal(response.status, 401);
    assert.deepEqual(await response.json(), { error: "unauthorized" });
  });

  it("returns 400 speech payload for invalid envelope", async () => {
    const response = await handleAlexaPost(
      new Request("http://localhost/api/channels/alexa", {
        method: "POST",
        headers: {
          authorization: "Bearer secret",
          "content-type": "application/json",
        },
        body: JSON.stringify({ session: { sessionId: "missing-request" } }),
      }),
      {
        isEnabled: () => true,
        getSecret: () => "secret",
        getUserId: () => "user-1",
        persist: async () => ({ id: "memory-1" }),
        getRecent: async () => [],
        nowMs: () => 0,
      }
    );

    assert.equal(response.status, 400);
    const payload = await response.json();
    assert.match(extractSpeechText(payload), /could not read that request/i);
  });

  it("handles CaptureIntent and writes note through ingest path", async () => {
    const calls: Array<{ userId: string; content: string; source: string }> =
      [];
    const response = await handleAlexaPost(
      new Request("http://localhost/api/channels/alexa", {
        method: "POST",
        headers: {
          authorization: "Bearer secret",
          "content-type": "application/json",
        },
        body: JSON.stringify({
          request: {
            type: "IntentRequest",
            intent: {
              name: "CaptureIntent",
              slots: {
                note: { name: "note", value: "Review roadmap Friday" },
              },
            },
          },
          session: {
            sessionId: "session-1",
            user: { userId: "amzn1.ask.account.123" },
          },
        }),
      }),
      {
        isEnabled: () => true,
        getSecret: () => "secret",
        getUserId: () => "user-1",
        persist: ({ userId, body }) => {
          calls.push({
            userId,
            content: body.content,
            source: body.source,
          });
          return Promise.resolve({ id: "memory-1" });
        },
        getRecent: async () => [],
        nowMs: () => 0,
      }
    );

    assert.equal(response.status, 200);
    const payload = await response.json();
    assert.match(extractSpeechText(payload), /saved\. i captured that note/i);
    assert.equal(calls.length, 1);
    assert.equal(calls[0]?.userId, "user-1");
    assert.equal(calls[0]?.content, "Review roadmap Friday");
    assert.equal(calls[0]?.source, "alexa");
  });

  it("handles StatusIntent and summarizes recent captures", async () => {
    const response = await handleAlexaPost(
      new Request("http://localhost/api/channels/alexa", {
        method: "POST",
        headers: {
          authorization: "Bearer secret",
          "content-type": "application/json",
        },
        body: JSON.stringify({
          request: {
            type: "IntentRequest",
            intent: { name: "StatusIntent" },
          },
        }),
      }),
      {
        isEnabled: () => true,
        getSecret: () => "secret",
        getUserId: () => "user-1",
        persist: async () => ({ id: "memory-1" }),
        getRecent: async () => [
          { content: "First capture" },
          { content: "Second capture" },
          { content: "Third capture" },
        ],
        nowMs: () => 1_000_000,
      }
    );

    assert.equal(response.status, 200);
    const payload = await response.json();
    assert.match(extractSpeechText(payload), /recent captures/i);
    assert.match(extractSpeechText(payload), /first capture/i);
  });
});
