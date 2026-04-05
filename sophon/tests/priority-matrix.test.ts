import assert from "node:assert/strict";
import { test } from "node:test";

import { SOPHON_MAX_PRIORITIES, SOPHON_MIN_PRIORITIES } from "../src/config";
import {
  pickAdaptivePriorityCount,
  scorePriorityMatrix,
} from "../src/priority-matrix";
import type { SophonCandidateItem } from "../src/types";

const fixtures: SophonCandidateItem[] = [
  {
    id: "a",
    title: "File taxes",
    source: "manual",
    impact: 0.9,
    urgency: 0.85,
    commitmentRisk: 0.8,
    effortFit: 0.4,
    decayRisk: 0.7,
    dueAt: null,
  },
  {
    id: "b",
    title: "Clean inbox",
    source: "memory",
    impact: 0.2,
    urgency: 0.25,
    commitmentRisk: 0.2,
    effortFit: 0.8,
    decayRisk: 0.3,
    dueAt: null,
  },
];

test("adaptive focus shrinks under high pressure", () => {
  const n = pickAdaptivePriorityCount({
    calendarLoad: 0.9,
    carryoverLoad: 0.85,
    stalenessPressure: 0.8,
  });
  assert.equal(n, SOPHON_MIN_PRIORITIES);
});

test("adaptive focus expands under low pressure", () => {
  const n = pickAdaptivePriorityCount({
    calendarLoad: 0.1,
    carryoverLoad: 0.2,
    stalenessPressure: 0.2,
  });
  assert.equal(n, SOPHON_MAX_PRIORITIES);
});

test("ranking is deterministic with explanation tokens", () => {
  const ranked = scorePriorityMatrix(fixtures);
  assert.equal(ranked.length, fixtures.length);
  assert.equal(ranked.at(0)?.id, "a");
  assert.equal(ranked.at(1)?.id, "b");
  assert.equal(ranked.at(0)?.explanations.length, 5);
});

test("ranking tie-break uses title ascending when scores match", () => {
  const tiedItems: SophonCandidateItem[] = [
    {
      id: "x",
      title: "Zoo",
      source: "manual",
      impact: 0.5,
      urgency: 0.5,
      commitmentRisk: 0.5,
      effortFit: 0.5,
      decayRisk: 0.5,
      dueAt: null,
    },
    {
      id: "y",
      title: "Alpha",
      source: "manual",
      impact: 0.5,
      urgency: 0.5,
      commitmentRisk: 0.5,
      effortFit: 0.5,
      decayRisk: 0.5,
      dueAt: null,
    },
  ];

  const ranked = scorePriorityMatrix(tiedItems);
  assert.equal(ranked.at(0)?.title, "Alpha");
  assert.equal(ranked.at(1)?.title, "Zoo");
});

test("non-finite dimensions are clamped to zero", () => {
  const weirdItems: SophonCandidateItem[] = [
    {
      id: "nan",
      title: "Weird",
      source: "manual",
      impact: Number.NaN,
      urgency: Number.POSITIVE_INFINITY,
      commitmentRisk: Number.NEGATIVE_INFINITY,
      effortFit: 0.2,
      decayRisk: 0.1,
      dueAt: null,
    },
  ];
  const ranked = scorePriorityMatrix(weirdItems);
  assert.ok(Number.isFinite(ranked.at(0)?.score));
  assert.ok(Math.abs((ranked.at(0)?.score ?? 0) - 0.04) < 1e-9);
});
