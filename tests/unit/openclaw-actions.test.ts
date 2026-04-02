import assert from "node:assert/strict";
import test from "node:test";

import {
  buildOpenClawIntentFromVirgilEvent,
  OPENCLAW_EVENT_ACTIONS,
} from "../../lib/integrations/openclaw-actions";
import type { VirgilBridgeEvent } from "../../lib/integrations/openclaw-types";

test("unknown event type returns null", () => {
  const event: VirgilBridgeEvent = {
    type: "totally_unknown_event",
    payload: { nudgeText: "hello" },
  };
  assert.equal(buildOpenClawIntentFromVirgilEvent(event), null);
});

test("habit_stale with empty nudgeText returns null", () => {
  const event: VirgilBridgeEvent = {
    type: "habit_stale",
    payload: { nudgeText: "" },
  };
  assert.equal(buildOpenClawIntentFromVirgilEvent(event), null);
});

test("habit_stale requires confirmation (send-whatsapp is outbound)", () => {
  const event: VirgilBridgeEvent = {
    type: "habit_stale",
    payload: { nudgeText: "Time to stretch" },
  };
  const intent = buildOpenClawIntentFromVirgilEvent(event);
  assert.ok(intent);
  assert.equal(intent.skill, "send-whatsapp");
  assert.equal(intent.requiresConfirmation, true);
  assert.equal(intent.source, "event-bus");
});

test("ticket_deadline_approaching gets confirmation via safety net", () => {
  const event: VirgilBridgeEvent = {
    type: "ticket_deadline_approaching",
    payload: { nudgeText: "PR review due today" },
  };
  const intent = buildOpenClawIntentFromVirgilEvent(event);
  assert.ok(intent);
  assert.equal(intent.skill, "send-slack");
  assert.equal(intent.priority, "high");
  assert.equal(
    intent.requiresConfirmation,
    true,
    "safety net should flag send-slack as needing confirmation"
  );
});

test("OPENCLAW_EVENT_ACTIONS has expected keys", () => {
  assert.ok("habit_stale" in OPENCLAW_EVENT_ACTIONS);
  assert.ok("ticket_deadline_approaching" in OPENCLAW_EVENT_ACTIONS);
});
