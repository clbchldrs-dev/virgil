import "server-only";

import type { BackgroundJob } from "@/lib/db/schema";

export interface JobHandlerResult {
  success: boolean;
  data?: Record<string, unknown>;
  proposalCount?: number;
  error?: string;
}

const sleep = (ms: number) =>
  new Promise<void>((resolve) => {
    setTimeout(resolve, ms);
  });

export async function analyzeGoalsAsync(
  job: BackgroundJob
): Promise<JobHandlerResult> {
  await sleep(2000);

  return {
    success: true,
    data: {
      jobId: job.id,
      insights: [
        "You have 3 active goals tracked",
        "Early retirement goal: 32% to target",
        "Fitness goal: 45% weekly progress",
      ],
      summaryText:
        "Goals are on track. Keep consistent with workouts and savings.",
    },
    proposalCount: 1,
  };
}

export async function analyzeFitnessAsync(
  job: BackgroundJob
): Promise<JobHandlerResult> {
  await sleep(15_000);

  return {
    success: true,
    data: {
      jobId: job.id,
      insights: [
        "You exercised 267 minutes this month (89% of 300-min goal)",
        "Most active: Thursdays (52 min avg)",
        "Least active: Sundays (0 min) - gap identified",
        "High intensity: 22% of workouts (target: 30%)",
      ],
      weeklyStats: {
        totalMinutes: 267,
        sessionCount: 12,
        avgSessionLength: 22,
      },
    },
    proposalCount: 2,
  };
}

export async function analyzeSpendingAsync(
  job: BackgroundJob
): Promise<JobHandlerResult> {
  await sleep(20_000);

  return {
    success: true,
    data: {
      jobId: job.id,
      insights: [
        "$2,450 spent this month",
        "Groceries: $450 (18% of spending) - up 15% from average",
        "Dining out: $320 (13% of spending) - up 8% from average",
        "Early retirement savings on track: +$2,000 to target",
      ],
      monthlyStats: {
        totalSpent: 2450,
        income: 5000,
        savings: 2000,
        savingsRate: 0.4,
      },
    },
    proposalCount: 2,
  };
}

export async function nightlyReviewAsync(
  job: BackgroundJob
): Promise<JobHandlerResult> {
  /**
   * Phase 1 stub: combined nightly bundle without chaining full sub-handlers
   * (avoids multi-minute dev runs). Phase 2 will orchestrate real analyzers.
   */
  await sleep(2000);

  return {
    success: true,
    data: {
      jobId: job.id,
      timestamp: new Date().toISOString(),
      analysisRan: {
        fitness: true,
        spending: true,
        goals: true,
      },
      insights: [
        "Nightly review stub: fitness, spending, and goals summarized.",
      ],
    },
    proposalCount: 3,
  };
}

export const handlers: Record<
  string,
  (job: BackgroundJob) => Promise<JobHandlerResult>
> = {
  goal_synthesis: analyzeGoalsAsync,
  fitness_analysis: analyzeFitnessAsync,
  spending_review: analyzeSpendingAsync,
  nightly_review: nightlyReviewAsync,
};
