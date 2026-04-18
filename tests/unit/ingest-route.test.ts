import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { handleIngestPost } from "@/lib/ingest/ingest-route-handler";

import {
  mapIngestTypeToMemoryKind,
  virgilGeneralIngestBodySchema,
} from "@/lib/ingest/virgil-general-ingest-schema";
import { isVirgilIngestEnabled } from "@/lib/virgil/integrations";

describe("general ingest schema", () => {
  it("accepts valid payloads", () => {
    const parsed = virgilGeneralIngestBodySchema.safeParse({
      type: "note",
      content: "hello",
    });
    assert.equal(parsed.success, true);
    if (parsed.success) {
      assert.equal(parsed.data.source, "api");
    }
  });

  it("rejects content over 4000 chars", () => {
    const parsed = virgilGeneralIngestBodySchema.safeParse({
      type: "note",
      content: "x".repeat(4001),
    });
    assert.equal(parsed.success, false);
  });

  it("rejects unknown type", () => {
    const parsed = virgilGeneralIngestBodySchema.safeParse({
      type: "nope",
      content: "a",
    });
    assert.equal(parsed.success, false);
  });
});

describe("mapIngestTypeToMemoryKind", () => {
  it("maps ingest types to Memory.kind", () => {
    assert.equal(mapIngestTypeToMemoryKind("note"), "note");
    assert.equal(mapIngestTypeToMemoryKind("link"), "note");
    assert.equal(mapIngestTypeToMemoryKind("quote"), "note");
    assert.equal(mapIngestTypeToMemoryKind("idea"), "goal");
    assert.equal(mapIngestTypeToMemoryKind("mood"), "fact");
    assert.equal(mapIngestTypeToMemoryKind("workout"), "fact");
    assert.equal(mapIngestTypeToMemoryKind("location"), "fact");
  });
});

describe("isVirgilIngestEnabled", () => {
  it("is off unless VIRGIL_INGEST_ENABLED=1", () => {
    const prev = process.env.VIRGIL_INGEST_ENABLED;
    try {
      process.env.VIRGIL_INGEST_ENABLED = undefined;
      assert.equal(isVirgilIngestEnabled(), false);
      process.env.VIRGIL_INGEST_ENABLED = "1";
      assert.equal(isVirgilIngestEnabled(), true);
    } finally {
      if (prev === undefined) {
        process.env.VIRGIL_INGEST_ENABLED = undefined;
      } else {
        process.env.VIRGIL_INGEST_ENABLED = prev;
      }
    }
  });
});

describe("handleIngestPost", () => {
  it("returns 403 when feature is disabled", async () => {
    const response = await handleIngestPost(
      new Request("http://localhost/api/ingest", { method: "POST" }),
      {
        isEnabled: () => false,
        getSecret: () => "secret",
        getUserId: () => "user-1",
        persist: async () => ({ id: "memory-1" }),
      }
    );

    assert.equal(response.status, 403);
    assert.deepEqual(await response.json(), { error: "ingest_disabled" });
  });

  it("returns 401 when bearer secret is invalid", async () => {
    const response = await handleIngestPost(
      new Request("http://localhost/api/ingest", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ type: "note", content: "hello" }),
      }),
      {
        isEnabled: () => true,
        getSecret: () => "secret",
        getUserId: () => "user-1",
        persist: async () => ({ id: "memory-1" }),
      }
    );

    assert.equal(response.status, 401);
    assert.deepEqual(await response.json(), { error: "unauthorized" });
  });

  it("returns 400 when request body is invalid", async () => {
    const response = await handleIngestPost(
      new Request("http://localhost/api/ingest", {
        method: "POST",
        headers: {
          authorization: "Bearer secret",
          "content-type": "application/json",
        },
        body: JSON.stringify({ type: "note", content: "" }),
      }),
      {
        isEnabled: () => true,
        getSecret: () => "secret",
        getUserId: () => "user-1",
        persist: async () => ({ id: "memory-1" }),
      }
    );

    assert.equal(response.status, 400);
    assert.deepEqual(await response.json(), { error: "invalid_body" });
  });

  it("persists valid payloads and returns memory row", async () => {
    const calls: Array<{
      userId: string;
      body: { type: string; content: string };
    }> = [];
    const response = await handleIngestPost(
      new Request("http://localhost/api/ingest", {
        method: "POST",
        headers: {
          authorization: "Bearer secret",
          "content-type": "application/json",
        },
        body: JSON.stringify({ type: "note", content: "capture this" }),
      }),
      {
        isEnabled: () => true,
        getSecret: () => "secret",
        getUserId: () => "user-1",
        persist: ({ userId, body }) => {
          calls.push({
            userId,
            body: { type: body.type, content: body.content },
          });
          return Promise.resolve({ id: "memory-1" });
        },
      }
    );

    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { memory: { id: "memory-1" } });
    assert.equal(calls.length, 1);
    assert.equal(calls[0]?.userId, "user-1");
    assert.equal(calls[0]?.body.type, "note");
    assert.equal(calls[0]?.body.content, "capture this");
  });
});
