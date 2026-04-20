import assert from "node:assert/strict";
import test from "node:test";
import { resolveDelegationSkill } from "@/lib/integrations/delegation-routing";

test("routing honors explicit skill when provided", () => {
  const result = resolveDelegationSkill({
    description: "Use browser automation to open docs",
    providedSkill: "web_fetch",
    lane: "research",
    advertisedSkills: ["generic-task"],
  });

  assert.equal(result.resolvedSkill, "web_fetch");
  assert.equal(result.trace.strategy, "explicit_skill");
});

test("routing prefers lane policy advertised skill", () => {
  const result = resolveDelegationSkill({
    description: "Fix this TypeScript bug",
    lane: "code",
    advertisedSkills: ["sessions_spawn", "generic-task"],
  });

  assert.equal(result.resolvedSkill, "sessions_spawn");
  assert.equal(result.trace.strategy, "lane_policy");
});

test("routing falls back to generic-task when no candidates match", () => {
  const result = resolveDelegationSkill({
    description: "Do a thing",
    lane: "home",
    advertisedSkills: [],
  });

  assert.equal(result.resolvedSkill, "generic-task");
  assert.equal(result.trace.strategy, "fallback_generic");
});
