import assert from "node:assert/strict";
import test from "node:test";
import { evaluateDelegationPreflight } from "@/lib/integrations/delegation-preflight";

test("preflight passes when no advertised skill contract is available", () => {
  const decision = evaluateDelegationPreflight({
    readiness: {
      score: 0.4,
      recommendation: "ask_for_clarification",
      reasons: ["Backend offline"],
      online: false,
      resolvedSkill: "generic-task",
      resolvedSkillAdvertised: false,
      providedSkill: null,
    },
    advertisedSkillCount: 0,
  });

  assert.equal(decision.ok, true);
  assert.equal(decision.reason, "ok");
});

test("preflight blocks when resolved skill is not advertised", () => {
  const decision = evaluateDelegationPreflight({
    readiness: {
      score: 0.2,
      recommendation: "ask_for_clarification",
      reasons: ["Resolved skill is not advertised"],
      online: true,
      resolvedSkill: "web",
      resolvedSkillAdvertised: false,
      providedSkill: "web",
    },
    advertisedSkillCount: 3,
  });

  assert.equal(decision.ok, false);
  assert.equal(decision.reason, "resolved_skill_not_advertised");
});
