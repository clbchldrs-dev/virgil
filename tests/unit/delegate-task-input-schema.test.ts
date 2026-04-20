import assert from "node:assert/strict";
import test from "node:test";

import { delegateTaskInputSchema } from "../../lib/ai/tools/delegate-task-input-schema";
import { delegationUnknownSkillMessage } from "../../lib/integrations/delegation-labels";

test("delegateTask input accepts optional fields omitted (undefined)", () => {
  const parsed = delegateTaskInputSchema.parse({
    description: "Do something useful here",
  });
  assert.equal(parsed.description, "Do something useful here");
  assert.equal(parsed.lane, undefined);
  assert.equal(parsed.skill, undefined);
  assert.equal(parsed.params, undefined);
  assert.equal(parsed.urgent, undefined);
});

test("delegateTask input accepts JSON null for optional fields (regression)", () => {
  const parsed = delegateTaskInputSchema.parse({
    description: "Do something useful here",
    lane: null,
    skill: null,
    params: null,
    urgent: null,
  });
  assert.equal(parsed.lane, null);
  assert.equal(parsed.skill, null);
  assert.equal(parsed.params, null);
  assert.equal(parsed.urgent, null);
});

test("delegateTask input rejects description shorter than 8 characters", () => {
  const result = delegateTaskInputSchema.safeParse({
    description: "short",
  });
  assert.equal(result.success, false);
});

test("delegationUnknownSkillMessage names backend and lists published skills hint", () => {
  const openClawMsg = delegationUnknownSkillMessage(
    "openclaw",
    "not-a-skill",
    "generic-task, send-whatsapp",
    ""
  );
  assert.match(openClawMsg, /OpenClaw/);
  assert.match(openClawMsg, /not-a-skill/);
  assert.match(openClawMsg, /Available: generic-task, send-whatsapp/);
  assert.match(
    openClawMsg,
    /Omit `skill` so one can be inferred from the description/
  );

  const hermesMsg = delegationUnknownSkillMessage(
    "hermes",
    "bad",
    "a, b",
    ", …"
  );
  assert.match(hermesMsg, /Hermes/);
  assert.match(hermesMsg, /Available: a, b, …/);
});
