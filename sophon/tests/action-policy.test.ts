import assert from "node:assert/strict";
import { test } from "node:test";

import { classifyActionRisk, routeActionMode } from "../src/action-policy";

test("high-impact actions never auto execute", () => {
  const risk = classifyActionRisk({
    kind: "message-send",
    reversible: false,
    externalSideEffect: true,
  });
  assert.equal(risk, "high");
  assert.equal(routeActionMode(risk), "suggest");
});

test("reversible internal reorder can auto execute", () => {
  const risk = classifyActionRisk({
    kind: "task-reorder",
    reversible: true,
    externalSideEffect: false,
  });
  assert.equal(risk, "low");
  assert.equal(routeActionMode(risk), "auto");
});
