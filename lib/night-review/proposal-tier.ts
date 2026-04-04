import "server-only";

import { saveMemoryRecord } from "@/lib/db/queries";

export async function runNightlyReview(userId: string): Promise<{
  insightsCount: number;
  proposalsCount: number;
}> {
  const insights = analyzeUserData(userId);
  const proposals = generateProposals(userId, insights);

  for (const insight of insights) {
    await saveMemoryRecord({
      userId,
      kind: "fact",
      tier: "observe",
      content: insight.text,
      metadata: insight.data ?? {},
    });
  }

  for (const proposal of proposals) {
    await saveMemoryRecord({
      userId,
      kind: "opportunity",
      tier: "propose",
      content: proposal.text,
      metadata: proposal.data ?? {},
      proposedAt: new Date(),
    });
  }

  return {
    insightsCount: insights.length,
    proposalsCount: proposals.length,
  };
}

function analyzeUserData(
  _userId: string
): Array<{ text: string; data: Record<string, unknown> }> {
  return [
    {
      text: "You exercised 267 minutes this month (89% of goal)",
      data: { category: "fitness", minutes: 267, goal: 300 },
    },
    {
      text: "Spending is on track with early retirement goals",
      data: { category: "finance", status: "on_track" },
    },
    {
      text: "You asked 47 questions this week about goal-setting",
      data: { category: "engagement", questions: 47 },
    },
  ];
}

function generateProposals(
  _userId: string,
  insights: Array<{ text: string; data: Record<string, unknown> }>
): Array<{ text: string; data: Record<string, unknown> }> {
  const proposals: Array<{ text: string; data: Record<string, unknown> }> = [];

  for (const insight of insights) {
    const category = insight.data.category;
    const minutes = insight.data.minutes;
    if (
      category === "fitness" &&
      typeof minutes === "number" &&
      minutes < 300
    ) {
      proposals.push({
        text: "You're 13% short of your fitness goal. Consider adding a 20-min workout on Sunday?",
        data: {
          type: "suggest_routine",
          day: "Sunday",
          duration: 20,
          activity: "yoga",
        },
      });
    }

    if (category === "finance") {
      proposals.push({
        text: "Your savings rate is great. Review your top 3 spending categories to optimize further?",
        data: {
          type: "deep_analysis",
          target: "spending_categories",
        },
      });
    }
  }

  return proposals;
}
