import { format } from "date-fns";
import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/app/(auth)/auth";
import { Button } from "@/components/ui/button";
import {
  countActionableNightReviewInsights,
  countPendingProposalsForUser,
  getRecentNightReviewRunsForUser,
} from "@/lib/db/queries";
import { isNightReviewEnabled } from "@/lib/night-review/config";

function outcomeLabel(outcome: string): string {
  switch (outcome) {
    case "ok":
      return "Completed";
    case "findings":
      return "Findings saved";
    case "skipped":
      return "Skipped";
    case "error":
      return "Error";
    default:
      return outcome;
  }
}

export default async function BackgroundActivityPage() {
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }

  const userId = session.user.id;
  const since = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);
  const sinceProposals = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
  const [recentRuns, actionableInsightsCount, pendingProposalsCount] =
    await Promise.all([
      getRecentNightReviewRunsForUser({ userId, limit: 10 }),
      countActionableNightReviewInsights({ userId, since }),
      countPendingProposalsForUser({ userId, since: sinceProposals }),
    ]);
  const nightReviewEnabled = isNightReviewEnabled();

  const lastRun = recentRuns[0];

  return (
    <div className="flex min-h-dvh items-start justify-center bg-background p-4 pt-12 md:pt-20">
      <div className="w-full max-w-3xl space-y-10">
        <div className="space-y-2">
          <h1 className="text-2xl font-semibold tracking-tight">
            Background activity
          </h1>
          <p className="text-muted-foreground">
            Work Virgil does on a schedule or in the background. Suggestions
            stay in review until you accept or dismiss them—nothing important
            changes without your say-so.
          </p>
        </div>

        <section className="space-y-4 rounded-xl border border-border/60 bg-card/30 p-6 shadow-[var(--shadow-float)]">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h2 className="text-lg font-medium">Night review</h2>
              <p className="text-muted-foreground text-sm">
                Scheduled analysis of recent chats. Outputs appear as memories
                you can accept or dismiss on Night insights.
              </p>
            </div>
            <Button asChild className="shrink-0" variant="secondary">
              <Link href="/night-insights">Open night insights</Link>
            </Button>
          </div>

          <dl className="grid gap-3 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-muted-foreground">Scheduling</dt>
              <dd className="font-medium">
                {nightReviewEnabled
                  ? "Enabled (server must run cron or QStash)"
                  : "Disabled (set NIGHT_REVIEW_ENABLED=1)"}
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">
                Actionable insights (14d)
              </dt>
              <dd className="font-medium">{actionableInsightsCount}</dd>
            </div>
            {lastRun ? (
              <>
                <div>
                  <dt className="text-muted-foreground">Last run</dt>
                  <dd className="font-medium">
                    {format(lastRun.createdAt, "MMM d, yyyy HH:mm")}
                  </dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Outcome</dt>
                  <dd className="font-medium">
                    {outcomeLabel(lastRun.outcome)}
                  </dd>
                </div>
              </>
            ) : (
              <div className="sm:col-span-2">
                <dt className="text-muted-foreground">Last run</dt>
                <dd className="text-muted-foreground font-medium">
                  No runs recorded yet for this account.
                </dd>
              </div>
            )}
          </dl>

          {recentRuns.length > 1 ? (
            <details className="text-sm">
              <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
                Recent runs ({recentRuns.length})
              </summary>
              <ul className="mt-3 space-y-2 border-t border-border/50 pt-3">
                {recentRuns.map((run) => (
                  <li
                    className="flex flex-wrap items-baseline justify-between gap-2"
                    key={run.id}
                  >
                    <span className="font-mono text-xs text-muted-foreground">
                      {run.windowKey}
                    </span>
                    <span>
                      {`${format(run.createdAt, "MMM d HH:mm")} — ${outcomeLabel(run.outcome)} (${(run.durationMs / 1000).toFixed(1)}s)`}
                    </span>
                  </li>
                ))}
              </ul>
            </details>
          ) : null}
        </section>

        <section className="space-y-4 rounded-xl border border-border/60 bg-card/30 p-6 shadow-[var(--shadow-float)]">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h2 className="text-lg font-medium">Proposals</h2>
              <p className="text-muted-foreground text-sm">
                Suggested actions (tier &quot;propose&quot;) from background
                jobs and analysis. Review and accept on the proposals
                page—nothing runs automatically.
              </p>
            </div>
            <Button asChild className="shrink-0" variant="secondary">
              <Link href="/proposals">Open proposals</Link>
            </Button>
          </div>
          <dl className="grid gap-3 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-muted-foreground">Pending (90d)</dt>
              <dd className="font-medium">{pendingProposalsCount}</dd>
            </div>
          </dl>
        </section>

        <section className="space-y-3 rounded-xl border border-dashed border-border/60 bg-muted/20 p-6">
          <h2 className="text-lg font-medium">Deep analysis (coming)</h2>
          <p className="text-muted-foreground text-sm">
            Longer jobs—multi-step reports, broad history review—will use a
            dedicated queue with explicit status, separate from live chat. That
            keeps fast answers fast and heavy work visible.
          </p>
        </section>
      </div>
    </div>
  );
}
