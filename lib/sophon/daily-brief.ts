import "server-only";

import { listSophonTasksForUser } from "@/lib/db/queries";
import type { BuildDailyCommandCenterOutput } from "@/sophon/src/build-daily-command-center";
import { buildDailyCommandCenter } from "@/sophon/src/build-daily-command-center";
import type { SophonSource } from "@/sophon/src/types";
import type {
  SerializedRankedSophonItem,
  SophonDailyBriefJson,
} from "./daily-brief-types";

function toSophonSource(source: string): SophonSource {
  if (
    source === "manual" ||
    source === "calendar" ||
    source === "existing-task" ||
    source === "memory" ||
    source === "habit"
  ) {
    return source;
  }
  return "manual";
}

function serializeRanked(
  brief: BuildDailyCommandCenterOutput
): SophonDailyBriefJson {
  const mapItem = (
    item: BuildDailyCommandCenterOutput["now"][number]
  ): SerializedRankedSophonItem => ({
    id: item.id,
    title: item.title,
    source: item.source,
    impact: item.impact,
    urgency: item.urgency,
    commitmentRisk: item.commitmentRisk,
    effortFit: item.effortFit,
    decayRisk: item.decayRisk,
    dueAt: item.dueAt ? item.dueAt.toISOString() : null,
    score: item.score,
    explanations: item.explanations,
  });

  return {
    now: brief.now.map(mapItem),
    next: brief.next.map(mapItem),
    later: brief.later.map(mapItem),
    staleness: brief.staleness,
    suggestedActions: brief.suggestedActions,
  };
}

/**
 * Option B daily brief from `SophonTask` rows. Calendar/memory streams use stub loads until wired.
 */
export async function getSophonDailyBriefForUser(
  userId: string
): Promise<SophonDailyBriefJson> {
  const tasks = await listSophonTasksForUser({ userId });
  const candidates = tasks.map((task) => ({
    id: task.id,
    title: task.title,
    source: toSophonSource(task.source),
    impact: 0.7,
    urgency: task.dueAt ? 0.8 : 0.4,
    commitmentRisk: 0.5,
    effortFit: Math.min(Math.max(task.effortFit / 100, 0), 1),
    decayRisk: 0.5,
    dueAt: task.dueAt,
  }));

  const brief = buildDailyCommandCenter({
    calendarLoad: 0.5,
    carryoverLoad: tasks.length > 8 ? 0.7 : 0.4,
    stalenessPressure: 0.4,
    candidates,
  });

  return serializeRanked(brief);
}
