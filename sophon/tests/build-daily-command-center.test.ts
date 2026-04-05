import assert from "node:assert/strict";
import { test } from "node:test";

import { buildDailyCommandCenter } from "../src/build-daily-command-center";

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
