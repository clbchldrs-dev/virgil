import assert from "node:assert/strict";
import test from "node:test";

import {
  delegationNeedsConfirmation,
  matchSkillFromDescription,
} from "../../lib/integrations/openclaw-match";

test("delegationNeedsConfirmation is true for outbound or destructive phrasing", () => {
  assert.equal(delegationNeedsConfirmation("remind me only", "note"), false);
  assert.equal(
    delegationNeedsConfirmation("send a WhatsApp to mom", "send-whatsapp"),
    true
  );
  assert.equal(delegationNeedsConfirmation("delete old logs", "cleanup"), true);
  assert.equal(
    delegationNeedsConfirmation("run shell backup", "run-shell"),
    true
  );
});

test("matchSkillFromDescription picks skill by token overlap", () => {
  const skills = ["send-whatsapp", "create-file", "run-shell"];
  assert.equal(
    matchSkillFromDescription("please message someone on whatsapp", skills),
    "send-whatsapp"
  );
  assert.equal(
    matchSkillFromDescription("create a new markdown file", skills),
    "create-file"
  );
  assert.equal(matchSkillFromDescription("hello world", skills), undefined);
});
