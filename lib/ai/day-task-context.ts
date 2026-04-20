import type { DayTask } from "@/lib/db/schema";

/**
 * Compact block for system prompts (gateway + slim + compact when day tasks are loaded).
 */
export function formatDayTasksForPrompt(
  tasks: DayTask[],
  forDate: string
): string {
  if (tasks.length === 0) {
    return "";
  }
  const lines = tasks.map((t) => {
    const done = t.completedAt != null;
    const mark = done ? "[x]" : "[ ]";
    return `- ${mark} ${t.title}`;
  });
  return `Today's checklist (${forDate}):\n${lines.join("\n")}`;
}
