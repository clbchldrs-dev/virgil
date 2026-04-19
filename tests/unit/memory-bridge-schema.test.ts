import assert from "node:assert/strict";
import test from "node:test";
import { memoryBridgeBodySchema } from "@/lib/memory-bridge/schema";

test("accepts search body", () => {
  const parsed = memoryBridgeBodySchema.safeParse({
    op: "search",
    query: "goals",
    limit: 10,
  });
  assert.equal(parsed.success, true);
  if (parsed.success) {
    assert.equal(parsed.data.op, "search");
    assert.equal(parsed.data.query, "goals");
    assert.equal(parsed.data.limit, 10);
  }
});

test("accepts save body", () => {
  const parsed = memoryBridgeBodySchema.safeParse({
    op: "save",
    kind: "note",
    content: "hello",
    metadata: { x: 1 },
  });
  assert.equal(parsed.success, true);
});

test("rejects empty query", () => {
  const parsed = memoryBridgeBodySchema.safeParse({
    op: "search",
    query: "",
  });
  assert.equal(parsed.success, false);
});
