export type SophonSource =
  | "manual"
  | "calendar"
  | "existing-task"
  | "memory"
  | "habit";

export type SophonCandidateItem = {
  id: string;
  title: string;
  source: SophonSource;
  impact: number;
  urgency: number;
  commitmentRisk: number;
  effortFit: number;
  decayRisk: number;
  dueAt: Date | null;
};

export type RankedSophonItem = SophonCandidateItem & {
  score: number;
  explanations: string[];
};
