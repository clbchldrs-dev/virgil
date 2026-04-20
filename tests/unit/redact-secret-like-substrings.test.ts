import assert from "node:assert/strict";
import test from "node:test";

import { redactSecretLikeSubstrings } from "@/lib/security/redact-secret-like-substrings";

test("redacts Bearer tokens", () => {
  assert.equal(
    redactSecretLikeSubstrings("Use Authorization: Bearer abcdefghi_jklmnop"),
    "Use Authorization: Bearer [redacted]"
  );
});

test("redacts URL userinfo", () => {
  assert.equal(
    redactSecretLikeSubstrings(
      "connect postgres://user:secret@db.example:5432/app"
    ),
    "connect postgres://[redacted]@db.example:5432/app"
  );
});

test("leaves normal URLs without userinfo", () => {
  assert.equal(
    redactSecretLikeSubstrings("see https://example.com/path"),
    "see https://example.com/path"
  );
});
