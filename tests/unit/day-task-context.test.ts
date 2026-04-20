import assert from "node:assert/strict";
import test from "node:test";

import { formatDayTasksForPrompt } from "../../lib/ai/day-task-context";
import type { DayTask } from "../../lib/db/schema";

function task(
  partial: Partial<DayTask> & Pick<DayTask, "id" | "title">
): DayTask {
  const now = new Date();
  return {
    userId: "u1",
    forDate: "2026-04-19",
    sortOrder: 0,
    completedAt: null,
    createdAt: now,
    updatedAt: now,
    ...partial,
  };
}

test("formatDayTasksForPrompt returns empty string when no tasks", () => {
  assert.equal(formatDayTasksForPrompt([], "2026-04-19"), "");
});

test("formatDayTasksForPrompt lists done and todo with date header", () => {
  const s = formatDayTasksForPrompt(
    [
      task({
        id: "a",
        title: "Alpha",
        completedAt: new Date("2026-04-19T12:00:00Z"),
      }),
      task({ id: "b", title: "Beta", completedAt: null }),
    ],
    "2026-04-19"
  );
  assert.match(s, /^Today's checklist \(2026-04-19\):/);
  assert.match(s, /\[x\] Alpha/);
  assert.match(s, /\[ \] Beta/);
});
