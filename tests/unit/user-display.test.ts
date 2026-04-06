import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { getUserDisplayFirstName } from "@/lib/user-display";

describe("getUserDisplayFirstName", () => {
  it("uses first token of name", () => {
    assert.equal(
      getUserDisplayFirstName({ name: "Caleb M.", email: "x@y.com" }),
      "Caleb"
    );
  });

  it("capitalizes email local part when no name", () => {
    assert.equal(
      getUserDisplayFirstName({ email: "caleb@example.com" }),
      "Caleb"
    );
  });

  it("detects guest emails", () => {
    assert.equal(
      getUserDisplayFirstName({ email: "guest-1730000000000" }),
      "Guest"
    );
  });
});
