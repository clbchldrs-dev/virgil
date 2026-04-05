import type { Goal } from "@/lib/db/schema";

/**
 * Compact block for system prompts (gateway + slim when goals are loaded).
 */
export function formatActiveGoalsForPrompt(goals: Goal[]): string {
  if (goals.length === 0) {
    return "";
  }
  const lines = goals.map((g) => {
    const cadence = g.targetCadence ? `, ${g.targetCadence}` : "";
    return `- ${g.title} (${g.category}${cadence}) — streak ${g.streakCurrent}`;
  });
  return `Active goals:\n${lines.join("\n")}`;
}
