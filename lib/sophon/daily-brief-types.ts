import type { SophonSource } from "@/sophon/src/types";

export type SerializedRankedSophonItem = {
  id: string;
  title: string;
  source: SophonSource;
  impact: number;
  urgency: number;
  commitmentRisk: number;
  effortFit: number;
  decayRisk: number;
  dueAt: string | null;
  score: number;
  explanations: string[];
};

export type SophonStalenessJson = {
  stage: number;
  reason:
    | "fresh"
    | "gentle-nudge"
    | "structured-reset"
    | "accountability-prompt";
};

export type SophonSuggestedActionJson = {
  itemId: string;
  risk: "low" | "medium" | "high";
  mode: "auto" | "approve" | "suggest";
};

export type SophonDailyBriefJson = {
  now: SerializedRankedSophonItem[];
  next: SerializedRankedSophonItem[];
  later: SerializedRankedSophonItem[];
  staleness: SophonStalenessJson;
  suggestedActions: SophonSuggestedActionJson[];
};
