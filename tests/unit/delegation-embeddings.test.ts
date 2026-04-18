import assert from "node:assert/strict";
import test from "node:test";
import { parseDelegationEmbeddingOutput } from "../../lib/integrations/delegation-embeddings";

test("parseDelegationEmbeddingOutput accepts embeddings array", () => {
  const raw = JSON.stringify({
    embeddings: [
      [0.1, 0.2],
      [0.3, 0.4],
    ],
    model: "nomic-embed-text",
  });
  const r = parseDelegationEmbeddingOutput(raw, 2);
  assert.equal(r.ok, true);
  if (!r.ok) {
    return;
  }
  assert.equal(r.embeddings.length, 2);
});

test("parseDelegationEmbeddingOutput maps single embedding key", () => {
  const raw = JSON.stringify({ embedding: [0.5, 0.6, 0.7] });
  const r = parseDelegationEmbeddingOutput(raw, 1);
  assert.equal(r.ok, true);
  if (!r.ok) {
    return;
  }
  assert.equal(r.embeddings.length, 1);
});

test("parseDelegationEmbeddingOutput rejects wrong count", () => {
  const raw = JSON.stringify({ embeddings: [[0.1]] });
  const r = parseDelegationEmbeddingOutput(raw, 2);
  assert.equal(r.ok, false);
  if (r.ok) {
    return;
  }
  assert.match(r.error, /Expected 2/);
});

test("parseDelegationEmbeddingOutput rejects empty output", () => {
  const r = parseDelegationEmbeddingOutput(undefined, 1);
  assert.equal(r.ok, false);
});
