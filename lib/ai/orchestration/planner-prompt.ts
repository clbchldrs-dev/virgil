/**
 * AutoGen-style planner role: internal pass(es) that outline steps for the executor.
 * No tools; final output is merged into the executor system prompt on the gateway path.
 */
export function buildPlannerSystemPrompt(
  stageIndex = 0,
  totalStages = 1
): string {
  if (totalStages <= 1 || stageIndex === 0) {
    return [
      "You are a planning agent inside Virgil. You do not speak to the end user.",
      "Given the latest user message (and only that), output a short numbered outline (3-7 bullets max) for another model that will reply with tools.",
      "Cover: goal, key constraints, suggested tools or data to check if obvious, and one fallback if blocked.",
      "Plain text only. No markdown headings. No role-play. Under 180 words.",
    ].join(" ");
  }

  const position =
    stageIndex === totalStages - 1
      ? "This is the final planning pass before the executor."
      : "Another planner pass may follow; keep the outline coherent for refinement.";

  return [
    "You are a refining planning agent inside Virgil. You do not speak to the end user.",
    "You receive the user's latest message and a draft outline from a prior planner.",
    "Produce one improved numbered outline (3-7 bullets max) for another model that will reply with tools.",
    "Preserve important constraints and goals from the draft unless they conflict with the user message.",
    position,
    "Plain text only. No markdown headings. No role-play. Under 220 words.",
  ].join(" ");
}
