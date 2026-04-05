import { classifyActionRisk, routeActionMode } from "./action-policy";
import {
  pickAdaptivePriorityCount,
  scorePriorityMatrix,
} from "./priority-matrix";
import { nextStalenessStage } from "./staleness-ladder";
import type { RankedSophonItem, SophonCandidateItem } from "./types";

export type BuildDailyCommandCenterInput = {
  calendarLoad: number;
  carryoverLoad: number;
  stalenessPressure: number;
  candidates: SophonCandidateItem[];
};

export type SuggestedAction = {
  itemId: string;
  risk: "low" | "medium" | "high";
  mode: "auto" | "approve" | "suggest";
};

export type BuildDailyCommandCenterOutput = {
  now: RankedSophonItem[];
  next: RankedSophonItem[];
  later: RankedSophonItem[];
  staleness: ReturnType<typeof nextStalenessStage>;
  suggestedActions: SuggestedAction[];
};

export const buildDailyCommandCenter = (
  input: BuildDailyCommandCenterInput
): BuildDailyCommandCenterOutput => {
  const priorityCount = pickAdaptivePriorityCount({
    calendarLoad: input.calendarLoad,
    carryoverLoad: input.carryoverLoad,
    stalenessPressure: input.stalenessPressure,
  });
  const ranked = scorePriorityMatrix(input.candidates);
  const now = ranked.slice(0, priorityCount);
  const next = ranked.slice(priorityCount, priorityCount + 3);
  const later = ranked.slice(priorityCount + 3);

  const staleness = nextStalenessStage({
    currentStage: 0,
    staleDays: Math.round(input.stalenessPressure * 14),
  });

  const suggestedActions: SuggestedAction[] = now.map((item) => {
    const risk = classifyActionRisk({
      kind: "task-reorder",
      reversible: true,
      externalSideEffect: false,
    });
    return {
      itemId: item.id,
      risk,
      mode: routeActionMode(risk),
    };
  });

  return { now, next, later, staleness, suggestedActions };
};
