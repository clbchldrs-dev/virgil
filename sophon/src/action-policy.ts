export type SophonActionRisk = "low" | "medium" | "high";
export type SophonActionMode = "auto" | "approve" | "suggest";

export type ClassifyActionRiskInput = {
  kind: string;
  reversible: boolean;
  externalSideEffect: boolean;
};

export const classifyActionRisk = (
  input: ClassifyActionRiskInput
): SophonActionRisk => {
  if (!input.reversible || input.externalSideEffect) {
    return "high";
  }
  if (input.kind === "calendar-draft" || input.kind === "task-reorder") {
    return "low";
  }
  return "medium";
};

export const routeActionMode = (risk: SophonActionRisk): SophonActionMode => {
  if (risk === "low") {
    return "auto";
  }
  if (risk === "medium") {
    return "approve";
  }
  return "suggest";
};
