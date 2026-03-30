import assert from "node:assert/strict";
import { test } from "node:test";
import { applyGoalRoutingHint } from "@/lib/chat/goal-routing-hint";

test("applyGoalRoutingHint leaves plain text unchanged", () => {
  assert.equal(applyGoalRoutingHint("hello"), "hello");
});

test("applyGoalRoutingHint prefixes /weekly", () => {
  const out = applyGoalRoutingHint("/weekly J: 4 Py: 6");
  assert.match(out, /^\[Weekly summary — use full/);
  assert.match(out, /J: 4 Py: 6$/);
});

test("applyGoalRoutingHint prefixes /weekly short", () => {
  const out = applyGoalRoutingHint("/weekly short metrics here");
  assert.match(out, /^\[Weekly summary — SHORT/);
  assert.match(out, /metrics here$/);
});

test("applyGoalRoutingHint prefixes /decision and /blocker", () => {
  assert.match(applyGoalRoutingHint("/decision A vs B"), /^\[Decision help/);
  assert.match(applyGoalRoutingHint("/blocker youtube"), /^\[Blocker /);
});
