import type {
  SophonActionMode,
  SophonActionRisk,
} from "@/lib/sophon/action-policy";
import {
  classifyActionRisk,
  routeActionMode,
} from "@/lib/sophon/action-policy";
import {
  pickAdaptivePriorityCount,
  scorePriorityMatrix,
} from "@/lib/sophon/priority-matrix";
import type { NextStalenessStageResult } from "@/lib/sophon/staleness-ladder";
import { nextStalenessStage } from "@/lib/sophon/staleness-ladder";
import type { RankedSophonItem, SophonCandidateItem } from "@/lib/sophon/types";

export type SophonSuggestedAction = {
  itemId: string;
  risk: SophonActionRisk;
  mode: SophonActionMode;
};

export type DailyCommandCenterBrief = {
  now: RankedSophonItem[];
  next: RankedSophonItem[];
  later: RankedSophonItem[];
  staleness: NextStalenessStageResult;
  suggestedActions: SophonSuggestedAction[];
};

export async function buildDailyCommandCenter({
  calendarLoad,
  carryoverLoad,
  stalenessPressure,
  candidates,
}: {
  calendarLoad: number;
  carryoverLoad: number;
  stalenessPressure: number;
  candidates: SophonCandidateItem[];
}): Promise<DailyCommandCenterBrief> {
  const priorityCount = await Promise.resolve(
    pickAdaptivePriorityCount({
      calendarLoad,
      carryoverLoad,
      stalenessPressure,
    })
  );
  const ranked = await Promise.resolve(scorePriorityMatrix(candidates));
  const now = ranked.slice(0, priorityCount);
  const next = ranked.slice(priorityCount, priorityCount + 3);
  const later = ranked.slice(priorityCount + 3);

  const staleDays = Math.round(stalenessPressure * 14);
  const staleness = await Promise.resolve(
    nextStalenessStage({
      currentStage: 0,
      staleDays,
    })
  );

  const suggestedActions = now.map((item) => {
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
}
