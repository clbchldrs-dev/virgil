import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { sanitizeAppCallbackUrl } from "@/lib/sanitize-callback-url";

describe("sanitizeAppCallbackUrl", () => {
  it("defaults to home", () => {
    assert.equal(sanitizeAppCallbackUrl(null), "/");
    assert.equal(sanitizeAppCallbackUrl(undefined), "/");
    assert.equal(sanitizeAppCallbackUrl(""), "/");
  });

  it("allows same-origin paths", () => {
    assert.equal(sanitizeAppCallbackUrl("/chat/abc"), "/chat/abc");
    assert.equal(sanitizeAppCallbackUrl("%2Fchat%2Fabc"), "/chat/abc");
  });

  it("rejects protocol-relative and non-path", () => {
    assert.equal(sanitizeAppCallbackUrl("//evil.com"), "/");
    assert.equal(sanitizeAppCallbackUrl("https://evil.com"), "/");
  });
});
