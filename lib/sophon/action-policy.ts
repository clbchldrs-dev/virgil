export type SophonActionRisk = "low" | "medium" | "high";
export type SophonActionMode = "auto" | "approve" | "suggest";

export function classifyActionRisk({
  kind,
  reversible,
  externalSideEffect,
}: {
  kind: string;
  reversible: boolean;
  externalSideEffect: boolean;
}): SophonActionRisk {
  if (!reversible || externalSideEffect) {
    return "high";
  }
  if (kind === "calendar-draft" || kind === "task-reorder") {
    return "low";
  }
  return "medium";
}

export function routeActionMode(risk: SophonActionRisk): SophonActionMode {
  if (risk === "low") {
    return "auto";
  }
  if (risk === "medium") {
    return "approve";
  }
  return "suggest";
}
