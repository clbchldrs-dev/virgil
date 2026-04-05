import assert from "node:assert/strict";
import { test } from "node:test";
import { formatActiveGoalsForPrompt } from "@/lib/ai/pivot-goal-context";
import type { Goal } from "@/lib/db/schema";

test("formatActiveGoalsForPrompt returns empty string when no goals", () => {
  assert.equal(formatActiveGoalsForPrompt([]), "");
});

test("formatActiveGoalsForPrompt lists titles and streaks", () => {
  const goals = [
    {
      id: "a",
      userId: "u",
      title: "Run 5k",
      category: "health",
      description: null,
      targetCadence: "weekly",
      status: "active",
      lastTouchedAt: new Date(),
      streakCurrent: 2,
      streakBest: 5,
      blockers: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  ] as Goal[];
  const out = formatActiveGoalsForPrompt(goals);
  assert.match(out, /Active goals/);
  assert.match(out, /Run 5k/);
  assert.match(out, /streak 2/);
});
