import assert from "node:assert/strict";
import { test } from "node:test";
import { evaluatePolicy } from "../src/core/policy-engine.js";
import type { InboundMessage } from "../src/core/schemas.js";

function message(
  body: string,
  channel: InboundMessage["channel"] = "slack"
): InboundMessage {
  return {
    channel,
    externalThreadId: "thread-1",
    externalMessageId: "msg-1",
    senderId: "sender-1",
    bodyText: body,
    receivedAt: new Date().toISOString(),
  };
}

test("shield mode holds even for low-risk trusted traffic", () => {
  const decision = evaluatePolicy({
    message: message("ok"),
    trustTier: "trusted",
    mode: "shield",
    storedMode: undefined,
  });
  assert.equal(decision.route, "hold");
});

test("sensitive language raises risk and avoids autopilot auto-send", () => {
  const decision = evaluatePolicy({
    message: message(
      "We should review the contract with our attorney and reset your password"
    ),
    trustTier: "trusted",
    mode: "autopilot-lite",
    storedMode: undefined,
  });
  assert.ok(decision.riskScore >= 45);
  assert.equal(decision.route, "approval");
});

test("extreme stacked risk routes to block", () => {
  const decision = evaluatePolicy({
    message: message(
      "password lawsuit wire transfer suicide guarantee termination HR contract"
    ),
    trustTier: "unknown",
    mode: "autopilot-lite",
    storedMode: undefined,
  });
  assert.equal(decision.route, "block");
});

test("assistant mode defaults to approval for non-trivial text", () => {
  const decision = evaluatePolicy({
    message: message("Can we reschedule the project review for next week?"),
    trustTier: "acquaintance",
    mode: "assistant",
    storedMode: undefined,
  });
  assert.equal(decision.route, "approval");
});
