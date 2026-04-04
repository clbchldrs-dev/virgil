import { NextResponse } from "next/server";
import { auth } from "@/app/(auth)/auth";
import {
  countActionableNightReviewInsights,
  getRecentNightReviewRunsForUser,
} from "@/lib/db/queries";
import { isNightReviewEnabled } from "@/lib/night-review/config";

export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return new Response("Unauthorized", { status: 401 });
  }

  const userId = session.user.id;
  const since = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);
  const [recentRuns, actionableInsightsCount] = await Promise.all([
    getRecentNightReviewRunsForUser({ userId, limit: 10 }),
    countActionableNightReviewInsights({ userId, since }),
  ]);

  return NextResponse.json({
    nightReview: {
      enabled: isNightReviewEnabled(),
      recentRuns,
      actionableInsightsCount,
    },
    deepAnalysis: {
      status: "not_available" as const,
      message:
        "Long-running analysis jobs will show status here when available.",
    },
  });
}
