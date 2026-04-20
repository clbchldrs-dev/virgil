import assert from "node:assert/strict";
import test from "node:test";
import { evaluateDelegationReadiness } from "@/lib/integrations/delegation-readiness";

test("readiness recommends delegate when online and skill is advertised", () => {
  const readiness = evaluateDelegationReadiness({
    online: true,
    providedSkill: "sessions_list",
    resolvedSkill: "sessions_list",
    skillDescriptors: [
      {
        id: "sessions_list",
        name: "sessions_list",
        contractVersion: "v0-name-only",
        contractStatus: "name_only",
        description: null,
        inputSchema: null,
        riskLevel: "low",
        requiresConfirmation: null,
        examples: [],
        sourceBackends: ["hermes"],
        discoveredAt: "2026-04-20T00:00:00.000Z",
      },
    ],
  });

  assert.equal(readiness.recommendation, "delegate");
  assert.equal(readiness.resolvedSkillAdvertised, true);
  assert.ok(readiness.score >= 0.65);
});

test("readiness recommends clarification when offline and skill unavailable", () => {
  const readiness = evaluateDelegationReadiness({
    online: false,
    providedSkill: "web",
    resolvedSkill: "web",
    skillDescriptors: [],
  });

  assert.equal(readiness.recommendation, "ask_for_clarification");
  assert.equal(readiness.resolvedSkillAdvertised, false);
  assert.ok(readiness.score < 0.45);
});
