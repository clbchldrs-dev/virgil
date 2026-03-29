import assert from "node:assert/strict";
import test from "node:test";
import {
  anonymizedUserRef,
  formatIssueBody,
  type ProductOpportunityPayload,
  sanitizeProductOpportunityToolError,
} from "../../lib/github/product-opportunity-issue";

const samplePayload: ProductOpportunityPayload = {
  title: "Better Ollama errors",
  problem: "Users see generic failures.",
  userEvidence: "User asked why chat failed.",
  proposedSlice: "Map provider errors in UI.",
  nonGoals: "No new cloud dependencies.",
  alignmentLocalFirst: true,
  alignmentLowCost: true,
  alignmentTestable: "pnpm check + manual stop Ollama",
  chatId: "chat-uuid",
  userRef: "abc123deadbeef",
};

test("formatIssueBody includes sections and meta", () => {
  const body = formatIssueBody(samplePayload);
  assert.match(body, /## Problem/);
  assert.match(body, /Users see generic failures/);
  assert.match(body, /Local-first/);
  assert.match(body, /chat-uuid/);
  assert.match(body, /abc123deadbeef/);
});

test("anonymizedUserRef is stable and short", () => {
  const a = anonymizedUserRef("user-1");
  const b = anonymizedUserRef("user-1");
  const c = anonymizedUserRef("user-2");
  assert.equal(a, b);
  assert.notEqual(a, c);
  assert.equal(a.length, 12);
});

test("sanitizeProductOpportunityToolError hides GitHub response bodies", () => {
  assert.match(
    sanitizeProductOpportunityToolError(
      new Error('GitHub API 401: {"message":"Bad credentials"}')
    ),
    /authentication/i
  );
  assert.doesNotMatch(
    sanitizeProductOpportunityToolError(
      new Error('GitHub API 401: {"message":"Bad credentials"}')
    ),
    /Bad credentials/
  );
  assert.equal(
    sanitizeProductOpportunityToolError(
      new Error("GitHub product opportunity is not configured")
    ),
    "GitHub product opportunity is not configured"
  );
  assert.match(
    sanitizeProductOpportunityToolError(new Error("GitHub API 422: labels")),
    /validation/i
  );
});
