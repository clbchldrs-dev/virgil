import assert from "node:assert/strict";
import { test } from "node:test";
import type { StalenessStage } from "@/lib/sophon/staleness-ladder";
import {
  nextStalenessStage,
  shouldApplyStalenessIntervention,
} from "@/lib/sophon/staleness-ladder";

function expectedReasonForStage(stage: StalenessStage) {
  if (stage === 0) {
    return "fresh";
  }
  if (stage === 1) {
    return "gentle-nudge";
  }
  if (stage === 2) {
    return "structured-reset";
  }
  return "accountability-prompt";
}

test("staleness ladder escalates progressively", () => {
  assert.equal(nextStalenessStage({ currentStage: 0, staleDays: 3 }).stage, 1);
  assert.equal(nextStalenessStage({ currentStage: 1, staleDays: 7 }).stage, 2);
  assert.equal(nextStalenessStage({ currentStage: 2, staleDays: 14 }).stage, 3);
});

test("staleness ladder stays fresh below gentle threshold", () => {
  const out = nextStalenessStage({ currentStage: 2, staleDays: 1 });
  assert.equal(out.stage, 0);
  assert.equal(out.reason, "fresh");
  assert.equal(out.cooldownDays, 0);
});

test("reason always matches returned stage (no bucket vs floor mismatch)", () => {
  const currentStages = [0, 1, 2, 3] as const;
  const staleDaysSamples = [0, 1, 2, 3, 5, 6, 8, 11, 12, 20];
  for (const currentStage of currentStages) {
    for (const staleDays of staleDaysSamples) {
      const out = nextStalenessStage({ currentStage, staleDays });
      assert.equal(
        out.reason,
        expectedReasonForStage(out.stage),
        `currentStage=${currentStage} staleDays=${staleDays}`
      );
    }
  }
});

test("high current stage in earlier time bucket uses stage-aligned reason (regression)", () => {
  const out = nextStalenessStage({ currentStage: 2, staleDays: 3 });
  assert.equal(out.stage, 2);
  assert.equal(out.reason, "structured-reset");

  const accountabilityToneWhileStructuredWindow = nextStalenessStage({
    currentStage: 3,
    staleDays: 8,
  });
  assert.equal(accountabilityToneWhileStructuredWindow.stage, 3);
  assert.equal(
    accountabilityToneWhileStructuredWindow.reason,
    "accountability-prompt"
  );
});

test("staleness ladder attaches cooldown metadata per stage", () => {
  const gentle = nextStalenessStage({ currentStage: 0, staleDays: 3 });
  assert.equal(gentle.reason, "gentle-nudge");
  assert.ok(gentle.cooldownDays > 0);

  const structured = nextStalenessStage({ currentStage: 0, staleDays: 8 });
  assert.equal(structured.reason, "structured-reset");
  assert.ok(structured.cooldownDays >= gentle.cooldownDays);

  const accountability = nextStalenessStage({ currentStage: 0, staleDays: 14 });
  assert.equal(accountability.reason, "accountability-prompt");
  assert.ok(accountability.cooldownDays >= structured.cooldownDays);
});

test("shouldApplyStalenessIntervention respects cooldown window", () => {
  assert.equal(
    shouldApplyStalenessIntervention({
      daysSinceLastIntervention: 1,
      requiredCooldownDays: 3,
    }),
    false
  );
  assert.equal(
    shouldApplyStalenessIntervention({
      daysSinceLastIntervention: 3,
      requiredCooldownDays: 3,
    }),
    true
  );
  assert.equal(
    shouldApplyStalenessIntervention({
      daysSinceLastIntervention: null,
      requiredCooldownDays: 3,
    }),
    true
  );
});
