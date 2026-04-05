import assert from "node:assert/strict";
import { test } from "node:test";
import {
  pickAdaptivePriorityCount,
  scorePriorityMatrix,
} from "@/lib/sophon/priority-matrix";
import type { SophonCandidateItem } from "@/lib/sophon/types";

const items: SophonCandidateItem[] = [
  {
    id: "a",
    title: "File taxes",
    source: "manual",
    impact: 0.9,
    urgency: 0.8,
    commitmentRisk: 0.9,
    effortFit: 0.3,
    decayRisk: 0.6,
    dueAt: null,
  },
  {
    id: "b",
    title: "Inbox cleanup",
    source: "memory",
    impact: 0.2,
    urgency: 0.3,
    commitmentRisk: 0.2,
    effortFit: 0.8,
    decayRisk: 0.4,
    dueAt: null,
  },
];

test("pickAdaptivePriorityCount biases low during heavy load", () => {
  const count = pickAdaptivePriorityCount({
    calendarLoad: 0.9,
    carryoverLoad: 0.8,
    stalenessPressure: 0.7,
  });
  assert.equal(count, 3);
});

test("pickAdaptivePriorityCount expands in low-friction days", () => {
  const count = pickAdaptivePriorityCount({
    calendarLoad: 0.2,
    carryoverLoad: 0.1,
    stalenessPressure: 0.2,
  });
  assert.equal(count, 7);
});

test("pickAdaptivePriorityCount interpolates between min and max in mid band", () => {
  const count = pickAdaptivePriorityCount({
    calendarLoad: 0.5,
    carryoverLoad: 0.5,
    stalenessPressure: 0.5,
  });
  assert.equal(count, 5);
});

const SCORED_DIMENSIONS = [
  "impact",
  "urgency",
  "commitmentRisk",
  "effortFit",
  "decayRisk",
] as const;

test("scorePriorityMatrix returns deterministic rank with explanations", () => {
  const ranked = scorePriorityMatrix(items);
  const top = ranked.at(0);
  assert.equal(top?.id, "a");
  assert.ok(top);
  for (const dim of SCORED_DIMENSIONS) {
    assert.ok(
      top.explanations.some((line) => line.startsWith(`${dim}:`)),
      `top item explanation should include ${dim}`
    );
  }
});

test("scorePriorityMatrix breaks ties by title with stable locale order", () => {
  const base = {
    source: "manual" as const,
    impact: 0.5,
    urgency: 0.5,
    commitmentRisk: 0.5,
    effortFit: 0.5,
    decayRisk: 0.5,
    dueAt: null,
  };
  const ranked = scorePriorityMatrix([
    { id: "2", title: "Zebra", ...base },
    { id: "1", title: "Apple", ...base },
  ]);
  assert.deepEqual(
    ranked.map((r) => r.id),
    ["1", "2"]
  );
});

test("scorePriorityMatrix breaks ties by id when score and title match", () => {
  const base = {
    source: "manual" as const,
    title: "Same",
    impact: 0.5,
    urgency: 0.5,
    commitmentRisk: 0.5,
    effortFit: 0.5,
    decayRisk: 0.5,
    dueAt: null,
  };
  const ranked = scorePriorityMatrix([
    { id: "z", ...base },
    { id: "a", ...base },
  ]);
  assert.deepEqual(
    ranked.map((r) => r.id),
    ["a", "z"]
  );
});

test("scorePriorityMatrix is deterministic across repeated runs", () => {
  const first = scorePriorityMatrix(items);
  const second = scorePriorityMatrix(items);
  assert.deepEqual(
    first.map((r) => ({
      id: r.id,
      score: r.score,
      explanations: r.explanations,
    })),
    second.map((r) => ({
      id: r.id,
      score: r.score,
      explanations: r.explanations,
    }))
  );
});
