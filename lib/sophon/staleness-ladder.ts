import {
  SOPHON_STALENESS_ACCOUNTABILITY_DAYS,
  SOPHON_STALENESS_GENTLE_DAYS,
  SOPHON_STALENESS_RESET_DAYS,
} from "@/lib/sophon/config";

export type StalenessStage = 0 | 1 | 2 | 3;

export type NextStalenessStageResult = {
  stage: StalenessStage;
  reason:
    | "fresh"
    | "gentle-nudge"
    | "structured-reset"
    | "accountability-prompt";
  /** Minimum days to wait before repeating an intervention at this level (dedup / calm UX). */
  cooldownDays: number;
};

function cooldownDaysForStage(stage: StalenessStage): number {
  if (stage === 0) {
    return 0;
  }
  if (stage === 1) {
    return 2;
  }
  if (stage === 2) {
    return 3;
  }
  return 7;
}

function reasonForStage(
  stage: StalenessStage
): NextStalenessStageResult["reason"] {
  if (stage === 0) {
    return "fresh";
  }
  if (stage === 1) {
    return "gentle-nudge";
  }
  if (stage === 2) {
    return "structured-reset";
  }
  return "accountability-prompt";
}

export function nextStalenessStage({
  currentStage,
  staleDays,
}: {
  currentStage: StalenessStage;
  staleDays: number;
}): NextStalenessStageResult {
  if (staleDays < SOPHON_STALENESS_GENTLE_DAYS) {
    return {
      stage: 0,
      reason: reasonForStage(0),
      cooldownDays: cooldownDaysForStage(0),
    };
  }
  if (staleDays < SOPHON_STALENESS_RESET_DAYS) {
    const stage = Math.max(1, currentStage) as StalenessStage;
    return {
      stage,
      reason: reasonForStage(stage),
      cooldownDays: cooldownDaysForStage(stage),
    };
  }
  if (staleDays < SOPHON_STALENESS_ACCOUNTABILITY_DAYS) {
    const stage = Math.max(2, currentStage) as StalenessStage;
    return {
      stage,
      reason: reasonForStage(stage),
      cooldownDays: cooldownDaysForStage(stage),
    };
  }
  const stage = 3 as StalenessStage;
  return {
    stage,
    reason: reasonForStage(stage),
    cooldownDays: cooldownDaysForStage(stage),
  };
}

export function shouldApplyStalenessIntervention({
  daysSinceLastIntervention,
  requiredCooldownDays,
}: {
  daysSinceLastIntervention: number | null;
  requiredCooldownDays: number;
}): boolean {
  if (requiredCooldownDays <= 0) {
    return true;
  }
  if (daysSinceLastIntervention === null) {
    return true;
  }
  return daysSinceLastIntervention >= requiredCooldownDays;
}
