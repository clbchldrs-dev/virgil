import {
  SOPHON_MAX_PRIORITIES,
  SOPHON_MIN_PRIORITIES,
  SOPHON_WEIGHTS,
} from "@/lib/sophon/config";
import type { RankedSophonItem, SophonCandidateItem } from "@/lib/sophon/types";

export function pickAdaptivePriorityCount({
  calendarLoad,
  carryoverLoad,
  stalenessPressure,
}: {
  calendarLoad: number;
  carryoverLoad: number;
  stalenessPressure: number;
}): number {
  const pressure = (calendarLoad + carryoverLoad + stalenessPressure) / 3;
  if (pressure >= 0.7) {
    return SOPHON_MIN_PRIORITIES;
  }
  if (pressure <= 0.3) {
    return SOPHON_MAX_PRIORITIES;
  }
  const spread = SOPHON_MAX_PRIORITIES - SOPHON_MIN_PRIORITIES;
  return SOPHON_MAX_PRIORITIES - Math.round(spread * pressure);
}

export function scorePriorityMatrix(
  items: SophonCandidateItem[]
): RankedSophonItem[] {
  return [...items]
    .map((item) => {
      const score =
        item.impact * SOPHON_WEIGHTS.impact +
        item.urgency * SOPHON_WEIGHTS.urgency +
        item.commitmentRisk * SOPHON_WEIGHTS.commitmentRisk +
        item.effortFit * SOPHON_WEIGHTS.effortFit +
        item.decayRisk * SOPHON_WEIGHTS.decayRisk;
      return {
        ...item,
        score,
        explanations: [
          `impact:${item.impact.toFixed(2)}`,
          `urgency:${item.urgency.toFixed(2)}`,
          `commitmentRisk:${item.commitmentRisk.toFixed(2)}`,
          `effortFit:${item.effortFit.toFixed(2)}`,
          `decayRisk:${item.decayRisk.toFixed(2)}`,
        ],
      };
    })
    .sort((a, b) => {
      const byScore = b.score - a.score;
      if (byScore !== 0) {
        return byScore;
      }
      const byTitle = a.title.localeCompare(b.title, "en", {
        numeric: true,
        sensitivity: "variant",
        usage: "sort",
      });
      if (byTitle !== 0) {
        return byTitle;
      }
      return a.id.localeCompare(b.id, "en", {
        numeric: true,
        sensitivity: "variant",
        usage: "sort",
      });
    });
}
