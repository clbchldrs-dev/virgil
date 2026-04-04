import "server-only";

import {
  getRecentMemories,
  listMemoriesForUser,
  listRecentGoalWeeklySnapshots,
  searchMemories,
} from "@/lib/db/queries";
import type { BackgroundJob } from "@/lib/db/schema";
import {
  type InsightLine,
  lookbackDate,
  lookbackDaysFromJobInput,
  persistJobInsights,
} from "./job-persistence";
import type { JobHandlerResult } from "./job-types";

const FITNESS_RE =
  /(workout|run|gym|step|cardio|exercise|bike|walk|mile|fitness|yoga|swim|lift|rep)/i;
const SPEND_RE =
  /(budget|spend|grocer|rent|save|retire|401|invest|cost|savings|expense|income|\$)/i;

function clip(text: string, max = 220): string {
  const t = text.trim().replace(/\s+/g, " ");
  if (t.length <= max) {
    return t;
  }
  return `${t.slice(0, max)}…`;
}

async function gatherGoalInsights(job: BackgroundJob): Promise<{
  insights: InsightLine[];
  proposals: InsightLine[];
  summary: Record<string, unknown>;
}> {
  const days = lookbackDaysFromJobInput(job.input, 90);
  const since = lookbackDate(days);
  const [goalMemories, recentAny, snapshots] = await Promise.all([
    listMemoriesForUser({ userId: job.userId, kind: "goal", limit: 24 }),
    getRecentMemories({ userId: job.userId, since, limit: 40 }),
    listRecentGoalWeeklySnapshots({ userId: job.userId, limit: 6 }),
  ]);

  const insights: InsightLine[] = [];
  const proposals: InsightLine[] = [];

  insights.push({
    text: `Goal synthesis used a ${days}-day lookback (from job input or default).`,
    data: { lookbackDays: days },
  });

  if (goalMemories.length === 0) {
    insights.push({
      text: "No memories with kind “goal” yet. Tell Virgil your goals in chat so they can be tracked here.",
      data: { emptyGoals: true },
    });
  } else {
    insights.push({
      text: `Found ${goalMemories.length} goal memory row(s) on file.`,
      data: { goalMemoryCount: goalMemories.length },
    });
    for (const g of goalMemories.slice(0, 4)) {
      insights.push({
        text: `Goal: ${clip(g.content, 280)}`,
        data: { memoryId: g.id },
      });
    }
  }

  if (snapshots.length === 0) {
    insights.push({
      text: "No weekly goal snapshots yet — when you use goal-guidance flows, summaries can land in GoalWeeklySnapshot.",
      data: { snapshots: 0 },
    });
    if (goalMemories.length > 0) {
      proposals.push({
        text: "Start logging weekly goal metrics so trends are visible across weeks.",
        data: { type: "weekly_snapshot" },
      });
    }
  } else {
    insights.push({
      text: `Found ${snapshots.length} recent weekly snapshot row(s).`,
      data: { snapshotWeeks: snapshots.length },
    });
    const latest = snapshots[0];
    if (latest) {
      insights.push({
        text: `Latest week ending ${String(latest.weekEnding)}: metrics recorded.`,
        data: {
          weekEnding: latest.weekEnding,
          metricsKeys: Object.keys(latest.metrics ?? {}),
        },
      });
    }
  }

  const goalish = recentAny.filter(
    (m) =>
      m.kind === "goal" ||
      /\b(goal|milestone|target|objective|habit)\b/i.test(m.content)
  );
  if (goalish.length > 0) {
    insights.push({
      text: `${goalish.length} recent memory mention(s) look goal-related (kind or wording).`,
      data: { relatedRecentCount: goalish.length },
    });
  }

  if (goalMemories.length >= 3 && snapshots.length >= 2) {
    proposals.push({
      text: "You have both goal memories and multi-week snapshots — good baseline for reviewing progress next time you plan the week.",
      data: { type: "review_weekly_plan" },
    });
  }

  return {
    insights,
    proposals,
    summary: {
      goalMemoryCount: goalMemories.length,
      snapshotCount: snapshots.length,
      relatedRecentCount: goalish.length,
    },
  };
}

async function gatherFitnessInsights(job: BackgroundJob): Promise<{
  insights: InsightLine[];
  proposals: InsightLine[];
  summary: Record<string, unknown>;
}> {
  const days = lookbackDaysFromJobInput(job.input, 45);
  const since = lookbackDate(days);
  const [recent, searchHits] = await Promise.all([
    getRecentMemories({ userId: job.userId, since, limit: 100 }),
    searchMemories({
      userId: job.userId,
      query: "exercise fitness workout run gym",
      limit: 8,
    }).catch(() => []),
  ]);

  const matched = recent.filter((m) => FITNESS_RE.test(m.content));
  const fromSearch = searchHits.filter(
    (m) => !matched.some((x) => x.id === m.id)
  );

  const insights: InsightLine[] = [];
  const proposals: InsightLine[] = [];

  insights.push({
    text: `Fitness scan used a ${days}-day lookback over memories.`,
    data: { lookbackDays: days },
  });

  if (matched.length === 0 && fromSearch.length === 0) {
    insights.push({
      text: "No clear fitness or exercise mentions in this window — say more in chat if you want movement tracking.",
      data: { signalCount: 0 },
    });
    proposals.push({
      text: "If movement matters this season, mention workouts or step counts occasionally so patterns can surface here.",
      data: { type: "encourage_logging" },
    });
  } else {
    insights.push({
      text: `Found ${matched.length} recent memory mention(s) matching fitness keywords; ${fromSearch.length} extra hit(s) from search.`,
      data: {
        keywordMatches: matched.length,
        searchMatches: fromSearch.length,
      },
    });
    const sample = [...matched, ...fromSearch].slice(0, 5);
    for (const m of sample) {
      insights.push({
        text: clip(m.content, 200),
        data: { memoryId: m.id },
      });
    }
    if (matched.length >= 3) {
      proposals.push({
        text: "You have several fitness notes — consider one weekly check-in on total active minutes or sessions.",
        data: { type: "weekly_movement_check" },
      });
    }
  }

  return {
    insights,
    proposals,
    summary: {
      keywordMatches: matched.length,
      searchMatches: fromSearch.length,
    },
  };
}

async function gatherSpendingInsights(job: BackgroundJob): Promise<{
  insights: InsightLine[];
  proposals: InsightLine[];
  summary: Record<string, unknown>;
}> {
  const days = lookbackDaysFromJobInput(job.input, 45);
  const since = lookbackDate(days);
  const [recent, searchHits] = await Promise.all([
    getRecentMemories({ userId: job.userId, since, limit: 100 }),
    searchMemories({
      userId: job.userId,
      query: "budget spend savings money cost",
      limit: 8,
    }).catch(() => []),
  ]);

  const matched = recent.filter((m) => SPEND_RE.test(m.content));
  const fromSearch = searchHits.filter(
    (m) => !matched.some((x) => x.id === m.id)
  );

  const insights: InsightLine[] = [];
  const proposals: InsightLine[] = [];

  insights.push({
    text: `Spending review used a ${days}-day lookback (memory text only — no bank connection).`,
    data: { lookbackDays: days },
  });

  if (matched.length === 0 && fromSearch.length === 0) {
    insights.push({
      text: "No spending or budget language surfaced in memories for this window.",
      data: { signalCount: 0 },
    });
    proposals.push({
      text: "Virgil does not see transactions — mention budgets or categories in chat if you want richer spending nudges.",
      data: { type: "clarify_data_source" },
    });
  } else {
    insights.push({
      text: `Found ${matched.length} memory mention(s) with money/budget language; ${fromSearch.length} extra from search.`,
      data: {
        keywordMatches: matched.length,
        searchMatches: fromSearch.length,
      },
    });
    const sample = [...matched, ...fromSearch].slice(0, 5);
    for (const m of sample) {
      insights.push({
        text: clip(m.content, 200),
        data: { memoryId: m.id },
      });
    }
    if (matched.length >= 2) {
      proposals.push({
        text: "You’ve noted several money topics — a single monthly “top 3 categories” review in chat could sharpen the picture.",
        data: { type: "monthly_category_review" },
      });
    }
  }

  return {
    insights,
    proposals,
    summary: {
      keywordMatches: matched.length,
      searchMatches: fromSearch.length,
    },
  };
}

export async function runGoalSynthesisJob(
  job: BackgroundJob
): Promise<JobHandlerResult> {
  const { insights, proposals, summary } = await gatherGoalInsights(job);
  const proposalCount = await persistJobInsights({ job, insights, proposals });
  return {
    success: true,
    data: {
      jobId: job.id,
      kind: job.kind,
      summary,
      insightLines: insights.length,
      proposalLines: proposals.length,
    },
    proposalCount,
  };
}

export async function runFitnessAnalysisJob(
  job: BackgroundJob
): Promise<JobHandlerResult> {
  const { insights, proposals, summary } = await gatherFitnessInsights(job);
  const proposalCount = await persistJobInsights({ job, insights, proposals });
  return {
    success: true,
    data: {
      jobId: job.id,
      kind: job.kind,
      summary,
      insightLines: insights.length,
      proposalLines: proposals.length,
    },
    proposalCount,
  };
}

export async function runSpendingReviewJob(
  job: BackgroundJob
): Promise<JobHandlerResult> {
  const { insights, proposals, summary } = await gatherSpendingInsights(job);
  const proposalCount = await persistJobInsights({ job, insights, proposals });
  return {
    success: true,
    data: {
      jobId: job.id,
      kind: job.kind,
      summary,
      insightLines: insights.length,
      proposalLines: proposals.length,
    },
    proposalCount,
  };
}

export async function runNightlyBundleJob(
  job: BackgroundJob
): Promise<JobHandlerResult> {
  const [goals, fitness, spending] = await Promise.all([
    gatherGoalInsights(job),
    gatherFitnessInsights(job),
    gatherSpendingInsights(job),
  ]);

  const insights = [
    {
      text: "Nightly bundle: combined goal, fitness, and spending passes over your memories.",
      data: { bundle: true },
    },
    ...goals.insights,
    ...fitness.insights,
    ...spending.insights,
  ];

  const proposals = [
    ...goals.proposals,
    ...fitness.proposals,
    ...spending.proposals,
  ];

  const proposalCount = await persistJobInsights({ job, insights, proposals });

  return {
    success: true,
    data: {
      jobId: job.id,
      kind: job.kind,
      bundle: {
        goals: goals.summary,
        fitness: fitness.summary,
        spending: spending.summary,
      },
      insightLines: insights.length,
      proposalLines: proposals.length,
    },
    proposalCount,
  };
}
