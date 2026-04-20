import assert from "node:assert/strict";
import test from "node:test";
import {
  type ResolveAgentTaskImpactTierInput,
  resolveAgentTaskImpactTier,
} from "@/lib/agent-tasks/impact-tier";

function tier(
  input: Omit<ResolveAgentTaskImpactTierInput, "metadata"> & {
    metadata?: Record<string, unknown>;
  }
) {
  return resolveAgentTaskImpactTier(input);
}

test("infra + low → elevated", () => {
  assert.equal(tier({ taskType: "infra", priority: "low" }), "elevated");
});

test("docs + critical → elevated", () => {
  assert.equal(tier({ taskType: "docs", priority: "critical" }), "elevated");
});

test("prompt + medium → standard", () => {
  assert.equal(tier({ taskType: "prompt", priority: "medium" }), "standard");
});

test("feature + high → elevated; feature + medium → standard", () => {
  assert.equal(tier({ taskType: "feature", priority: "high" }), "elevated");
  assert.equal(tier({ taskType: "feature", priority: "medium" }), "standard");
});

test("metadata.impactTierOverride wins", () => {
  assert.equal(
    tier({
      taskType: "infra",
      priority: "low",
      metadata: { impactTierOverride: "standard" },
    }),
    "standard"
  );
  assert.equal(
    tier({
      taskType: "prompt",
      priority: "medium",
      metadata: { impactTierOverride: "elevated" },
    }),
    "elevated"
  );
});
