import { redirect } from "next/navigation";
import { auth } from "@/app/(auth)/auth";
import { getNightReviewMemoriesForUser } from "@/lib/db/queries";
import { isNightReviewEnabled } from "@/lib/night-review/config";
import { NightInsightsClient } from "./night-insights-client";

export default async function NightInsightsPage() {
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }

  const since = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);
  const memories = await getNightReviewMemoriesForUser({
    userId: session.user.id,
    since,
    limit: 60,
    includeDismissed: false,
  });
  const nightReviewEnabled = isNightReviewEnabled();

  return (
    <div className="flex min-h-dvh items-start justify-center bg-background p-4 pt-12 md:pt-20">
      <div className="w-full max-w-3xl space-y-6">
        <div className="space-y-2">
          <h1 className="text-2xl font-semibold tracking-tight">
            Night insights
          </h1>
          <p className="text-muted-foreground">
            Suggestions from scheduled night review. Accept what you want to
            keep in mind, or dismiss noise.
          </p>
        </div>
        <NightInsightsClient
          initialMemories={memories}
          nightReviewEnabled={nightReviewEnabled}
        />
      </div>
    </div>
  );
}
