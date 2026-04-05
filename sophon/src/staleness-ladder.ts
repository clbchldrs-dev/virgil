export type StalenessStage = 0 | 1 | 2 | 3;

export type NextStalenessStageInput = {
  currentStage: StalenessStage;
  staleDays: number;
};

export type NextStalenessStageResult = {
  stage: StalenessStage;
  reason:
    | "fresh"
    | "gentle-nudge"
    | "structured-reset"
    | "accountability-prompt";
};

export const nextStalenessStage = (
  input: NextStalenessStageInput
): NextStalenessStageResult => {
  if (input.staleDays < 2) {
    return { stage: 0, reason: "fresh" };
  }
  if (input.staleDays < 6) {
    return {
      stage: Math.max(1, input.currentStage) as StalenessStage,
      reason: "gentle-nudge",
    };
  }
  if (input.staleDays < 12) {
    return {
      stage: Math.max(2, input.currentStage) as StalenessStage,
      reason: "structured-reset",
    };
  }
  return { stage: 3, reason: "accountability-prompt" };
};
