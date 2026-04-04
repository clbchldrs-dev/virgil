import assert from "node:assert/strict";
import test from "node:test";
import {
  chatOwnershipDenial,
  productOpportunityDeniedMessage,
} from "@/lib/ai/tool-policy";

test("chatOwnershipDenial: null chat", () => {
  assert.equal(chatOwnershipDenial(null, "u1"), "Chat not found.");
});

test("chatOwnershipDenial: wrong owner", () => {
  assert.equal(
    chatOwnershipDenial({ userId: "other" }, "u1"),
    "You cannot use tools in this chat."
  );
});

test("chatOwnershipDenial: ok", () => {
  assert.equal(chatOwnershipDenial({ userId: "u1" }, "u1"), null);
});

test("productOpportunityDeniedMessage: blocked", () => {
  assert.match(productOpportunityDeniedMessage(false) ?? "", /not available/i);
});

test("productOpportunityDeniedMessage: allowed", () => {
  assert.equal(productOpportunityDeniedMessage(true), null);
});
