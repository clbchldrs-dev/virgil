import {
  SOPHON_MAX_PRIORITIES,
  SOPHON_MIN_PRIORITIES,
  SOPHON_WEIGHTS,
} from "./config";
import type { RankedSophonItem, SophonCandidateItem } from "./types";

export const clampUnit = (n: number): number => {
  if (!Number.isFinite(n)) {
    return 0;
  }
  if (n < 0) {
    return 0;
  }
  if (n > 1) {
    return 1;
  }
  return n;
};

export type PickAdaptivePriorityCountInput = {
  calendarLoad: number;
  carryoverLoad: number;
  stalenessPressure: number;
};

export const pickAdaptivePriorityCount = (
  input: PickAdaptivePriorityCountInput
): number => {
  const calendarLoad = clampUnit(input.calendarLoad);
  const carryoverLoad = clampUnit(input.carryoverLoad);
  const stalenessPressure = clampUnit(input.stalenessPressure);
  const pressure = (calendarLoad + carryoverLoad + stalenessPressure) / 3;
  if (pressure >= 0.7) {
    return SOPHON_MIN_PRIORITIES;
  }
  if (pressure <= 0.3) {
    return SOPHON_MAX_PRIORITIES;
  }
  const spread = SOPHON_MAX_PRIORITIES - SOPHON_MIN_PRIORITIES;
  return SOPHON_MAX_PRIORITIES - Math.round(spread * pressure);
};

export const scorePriorityMatrix = (
  items: SophonCandidateItem[]
): RankedSophonItem[] => {
  const ranked: RankedSophonItem[] = items.map((item) => {
    const impact = clampUnit(item.impact);
    const urgency = clampUnit(item.urgency);
    const commitmentRisk = clampUnit(item.commitmentRisk);
    const effortFit = clampUnit(item.effortFit);
    const decayRisk = clampUnit(item.decayRisk);
    const score =
      SOPHON_WEIGHTS.impact * impact +
      SOPHON_WEIGHTS.urgency * urgency +
      SOPHON_WEIGHTS.commitmentRisk * commitmentRisk +
      SOPHON_WEIGHTS.effortFit * effortFit +
      SOPHON_WEIGHTS.decayRisk * decayRisk;
    const explanations = [
      `impact:${impact.toFixed(2)}`,
      `urgency:${urgency.toFixed(2)}`,
      `commitmentRisk:${commitmentRisk.toFixed(2)}`,
      `effortFit:${effortFit.toFixed(2)}`,
      `decayRisk:${decayRisk.toFixed(2)}`,
    ];
    return { ...item, score, explanations };
  });
  ranked.sort((a, b) => {
    if (b.score !== a.score) {
      return b.score - a.score;
    }
    return a.title.localeCompare(b.title);
  });
  return ranked;
};
