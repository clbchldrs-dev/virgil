import assert from "node:assert/strict";
import test from "node:test";
import {
  isGatewayAuthFailureError,
  isGatewayFallbackEligibleError,
  isGatewayRateLimitError,
} from "@/lib/ai/chat-fallback";

test("treats 429 / rate limit as eligible and not auth", () => {
  assert.equal(
    isGatewayRateLimitError(new Error("Request failed with status 429")),
    true
  );
  assert.equal(isGatewayAuthFailureError(new Error("status 429")), false);
  assert.equal(
    isGatewayFallbackEligibleError(new Error("rate limit exceeded")),
    true
  );
});

test("treats invalid API key / gateway auth as auth failure (not fallback)", () => {
  const e = new Error("AI Gateway authentication failed: invalid API key");
  assert.equal(isGatewayAuthFailureError(e), true);
  assert.equal(isGatewayRateLimitError(e), false);
  assert.equal(isGatewayFallbackEligibleError(e), false);
});

test("treats 401 as auth failure", () => {
  const e = new Error("Request failed with status code: 401");
  assert.equal(isGatewayAuthFailureError(e), true);
  assert.equal(isGatewayFallbackEligibleError(e), false);
});

test("does not treat 403 with rate wording as pure auth", () => {
  const e = new Error("status code: 403 rate limit");
  assert.equal(isGatewayAuthFailureError(e), false);
  assert.equal(isGatewayRateLimitError(e), true);
});

test("walks error.cause for nested messages", () => {
  const inner = new Error("too many requests");
  const outer = new Error("wrapped");
  outer.cause = inner;
  assert.equal(isGatewayRateLimitError(outer), true);
});
