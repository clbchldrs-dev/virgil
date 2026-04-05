import assert from "node:assert/strict";
import { describe, it } from "node:test";

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
