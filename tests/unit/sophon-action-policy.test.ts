import assert from "node:assert/strict";
import { test } from "node:test";
import {
  classifyActionRisk,
  routeActionMode,
} from "@/lib/sophon/action-policy";

test("high-impact actions never auto execute", () => {
  const risk = classifyActionRisk({
    kind: "message-send",
    reversible: false,
    externalSideEffect: true,
  });
  assert.equal(risk, "high");
  assert.equal(routeActionMode(risk), "suggest");
});

test("external side effect forces high risk even when reversible", () => {
  const risk = classifyActionRisk({
    kind: "task-reorder",
    reversible: true,
    externalSideEffect: true,
  });
  assert.equal(risk, "high");
  assert.equal(routeActionMode(risk), "suggest");
});

test("low-risk kinds route to auto when reversible and no external effect", () => {
  const calendar = classifyActionRisk({
    kind: "calendar-draft",
    reversible: true,
    externalSideEffect: false,
  });
  assert.equal(calendar, "low");
  assert.equal(routeActionMode(calendar), "auto");

  const reorder = classifyActionRisk({
    kind: "task-reorder",
    reversible: true,
    externalSideEffect: false,
  });
  assert.equal(reorder, "low");
  assert.equal(routeActionMode(reorder), "auto");
});

test("unknown reversible internal actions are medium and require approval", () => {
  const risk = classifyActionRisk({
    kind: "note-append",
    reversible: true,
    externalSideEffect: false,
  });
  assert.equal(risk, "medium");
  assert.equal(routeActionMode(risk), "approve");
});
