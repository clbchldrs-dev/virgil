import assert from "node:assert/strict";
import { test } from "node:test";
import { buildDailyCommandCenter } from "@/lib/sophon/build-daily-command-center";
import {
  pickAdaptivePriorityCount,
  scorePriorityMatrix,
} from "@/lib/sophon/priority-matrix";
import type { SophonCandidateItem } from "@/lib/sophon/types";

const STALENESS_REASONS = [
  "fresh",
  "gentle-nudge",
  "structured-reset",
  "accountability-prompt",
] as const;

function baseCandidate(
  id: string,
  title: string,
  scores: Pick<
    SophonCandidateItem,
    "impact" | "urgency" | "commitmentRisk" | "effortFit" | "decayRisk"
  >
): SophonCandidateItem {
  return {
    id,
    title,
    source: "manual",
    dueAt: null,
    ...scores,
  };
}

test("buildDailyCommandCenter returns concise now/next/later output", async () => {
  const out = await buildDailyCommandCenter({
    calendarLoad: 0.8,
    carryoverLoad: 0.5,
    stalenessPressure: 0.7,
    candidates: [
      {
        id: "task-1",
        title: "Renew insurance",
        source: "manual",
        impact: 0.9,
        urgency: 0.9,
        commitmentRisk: 0.8,
        effortFit: 0.6,
        decayRisk: 0.7,
        dueAt: null,
      },
    ],
  });
  assert.ok(out.now.length >= 1);
  assert.ok(out.next.length >= 0);
  assert.ok(out.later.length >= 0);
  assert.equal(out.now.length <= 7, true);
});

test("partition is ordered, complete, and disjoint across now/next/later", async () => {
  const candidates: SophonCandidateItem[] = [
    baseCandidate("top", "Zebra", {
      impact: 1,
      urgency: 1,
      commitmentRisk: 1,
      effortFit: 1,
      decayRisk: 1,
    }),
    baseCandidate("mid-a", "Yak", {
      impact: 0.92,
      urgency: 0.92,
      commitmentRisk: 0.92,
      effortFit: 0.92,
      decayRisk: 0.92,
    }),
    baseCandidate("mid-b", "Xray", {
      impact: 0.91,
      urgency: 0.91,
      commitmentRisk: 0.91,
      effortFit: 0.91,
      decayRisk: 0.91,
    }),
    baseCandidate("mid-c", "Quail", {
      impact: 0.9,
      urgency: 0.9,
      commitmentRisk: 0.9,
      effortFit: 0.9,
      decayRisk: 0.9,
    }),
    baseCandidate("tail", "Apple", {
      impact: 0.5,
      urgency: 0.5,
      commitmentRisk: 0.5,
      effortFit: 0.5,
      decayRisk: 0.5,
    }),
  ];

  const calendarLoad = 0.8;
  const carryoverLoad = 0.5;
  const stalenessPressure = 0.7;

  const out = await buildDailyCommandCenter({
    calendarLoad,
    carryoverLoad,
    stalenessPressure,
    candidates,
  });

  const ranked = scorePriorityMatrix(candidates);
  const priorityCount = pickAdaptivePriorityCount({
    calendarLoad,
    carryoverLoad,
    stalenessPressure,
  });

  const flat = [...out.now, ...out.next, ...out.later];
  assert.deepEqual(
    flat.map((item) => item.id),
    ranked.map((item) => item.id),
    "concatenation preserves global rank order"
  );
  assert.equal(
    flat.length,
    candidates.length,
    "every candidate appears exactly once across buckets"
  );
  assert.equal(out.now.length, priorityCount);
  assert.equal(
    out.next.length,
    Math.min(3, Math.max(0, ranked.length - priorityCount))
  );
  assert.equal(
    out.later.length,
    Math.max(0, ranked.length - priorityCount - 3)
  );

  const nowIds = new Set(out.now.map((item) => item.id));
  const nextIds = new Set(out.next.map((item) => item.id));
  const laterIds = new Set(out.later.map((item) => item.id));
  for (const id of nowIds) {
    assert.equal(nextIds.has(id), false);
    assert.equal(laterIds.has(id), false);
  }
  for (const id of nextIds) {
    assert.equal(laterIds.has(id), false);
  }
});

test("suggestedActions mirrors now with low risk and auto mode for task-reorder", async () => {
  const out = await buildDailyCommandCenter({
    calendarLoad: 0.8,
    carryoverLoad: 0.5,
    stalenessPressure: 0.7,
    candidates: [
      baseCandidate("task-1", "Renew insurance", {
        impact: 0.9,
        urgency: 0.9,
        commitmentRisk: 0.8,
        effortFit: 0.6,
        decayRisk: 0.7,
      }),
      baseCandidate("task-2", "Pay rent", {
        impact: 0.85,
        urgency: 0.88,
        commitmentRisk: 0.75,
        effortFit: 0.65,
        decayRisk: 0.72,
      }),
    ],
  });

  assert.equal(out.suggestedActions.length, out.now.length);
  for (let i = 0; i < out.now.length; i++) {
    const action = out.suggestedActions[i];
    assert.equal(action.itemId, out.now[i].id);
    assert.equal(action.risk, "low");
    assert.equal(action.mode, "auto");
  }
});

test("staleness payload is present and consistent with ladder for known pressure", async () => {
  const stalenessPressure = 0.7;
  const staleDays = Math.round(stalenessPressure * 14);

  const out = await buildDailyCommandCenter({
    calendarLoad: 0.2,
    carryoverLoad: 0.2,
    stalenessPressure,
    candidates: [
      baseCandidate("solo", "Only task", {
        impact: 0.5,
        urgency: 0.5,
        commitmentRisk: 0.5,
        effortFit: 0.5,
        decayRisk: 0.5,
      }),
    ],
  });

  assert.equal(staleDays, 10);
  assert.ok(STALENESS_REASONS.includes(out.staleness.reason));
  assert.equal(out.staleness.stage, 2);
  assert.equal(out.staleness.reason, "structured-reset");
  assert.equal(out.staleness.cooldownDays, 3);
  assert.ok(Number.isInteger(out.staleness.cooldownDays));
});

test("staleness stays in fresh band when pressure maps to few stale days", async () => {
  const out = await buildDailyCommandCenter({
    calendarLoad: 0.1,
    carryoverLoad: 0.1,
    stalenessPressure: 0.05,
    candidates: [
      baseCandidate("solo", "Only task", {
        impact: 0.5,
        urgency: 0.5,
        commitmentRisk: 0.5,
        effortFit: 0.5,
        decayRisk: 0.5,
      }),
    ],
  });

  assert.equal(Math.round(0.05 * 14), 1);
  assert.equal(out.staleness.stage, 0);
  assert.equal(out.staleness.reason, "fresh");
  assert.equal(out.staleness.cooldownDays, 0);
});
