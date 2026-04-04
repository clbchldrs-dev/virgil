import "server-only";

import type { BackgroundJob } from "@/lib/db/schema";
import type { JobHandlerResult } from "./job-types";
import {
  runFitnessAnalysisJob,
  runGoalSynthesisJob,
  runNightlyBundleJob,
  runSpendingReviewJob,
} from "./real-analysis";

export type { JobHandlerResult } from "./job-types";

export const handlers: Record<
  string,
  (job: BackgroundJob) => Promise<JobHandlerResult>
> = {
  goal_synthesis: runGoalSynthesisJob,
  fitness_analysis: runFitnessAnalysisJob,
  spending_review: runSpendingReviewJob,
  nightly_review: runNightlyBundleJob,
};
