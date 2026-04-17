import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { truncateSlackCheckinText } from "@/lib/integrations/slack-checkin";

describe("slack-checkin", () => {
  it("truncateSlackCheckinText leaves short text unchanged", () => {
    const s = "hello";
    assert.equal(truncateSlackCheckinText(s), s);
  });

  it("truncateSlackCheckinText caps long text with ellipsis", () => {
    const long = "a".repeat(4000);
    const out = truncateSlackCheckinText(long);
    assert.equal(out.length, 3500);
    assert.ok(out.endsWith("…"));
  });
});
