import assert from "node:assert/strict";
import test from "node:test";

import { emailAllowlistFromCommaList } from "../../lib/passwordless-email-allowlist";

test("passwordless allowlist trims, lowercases, and splits on commas", () => {
  const set = emailAllowlistFromCommaList(" A@B.co , c@d.org ");
  assert.equal(set.size, 2);
  assert.ok(set.has("a@b.co"));
  assert.ok(set.has("c@d.org"));
});

test("passwordless allowlist drops empty segments", () => {
  const set = emailAllowlistFromCommaList("one@test.co,, , two@test.co");
  assert.equal(set.size, 2);
  assert.ok(set.has("one@test.co"));
  assert.ok(set.has("two@test.co"));
});
