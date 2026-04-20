import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { shouldRunNightReviewTriggerInline } from "@/lib/night-review/trigger-inline-destination";

describe("shouldRunNightReviewTriggerInline", () => {
  it("is true for localhost and loopback IPv4/IPv6", () => {
    assert.equal(
      shouldRunNightReviewTriggerInline("http://localhost:3000"),
      true
    );
    assert.equal(
      shouldRunNightReviewTriggerInline("http://127.0.0.1:3000"),
      true
    );
    assert.equal(shouldRunNightReviewTriggerInline("http://[::1]:3000"), true);
  });

  it("is true for common private LAN ranges", () => {
    assert.equal(
      shouldRunNightReviewTriggerInline("http://10.0.0.1:3000"),
      true
    );
    assert.equal(
      shouldRunNightReviewTriggerInline("http://192.168.1.1:3000"),
      true
    );
    assert.equal(
      shouldRunNightReviewTriggerInline("http://172.16.0.1:3000"),
      true
    );
  });

  it("is false for public hosts", () => {
    assert.equal(
      shouldRunNightReviewTriggerInline("https://my-app.vercel.app"),
      false
    );
    assert.equal(
      shouldRunNightReviewTriggerInline("https://example.com"),
      false
    );
  });
});
