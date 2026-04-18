import { format } from "date-fns";
import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/app/(auth)/auth";
import { NightReviewTriggerButton } from "@/components/night-review-trigger-button";
import { Button } from "@/components/ui/button";
import {
  countActionableNightReviewInsights,
  countPendingProposalsForUser,
  getRecentNightReviewRunsForUser,
  listBackgroundJobsForUser,
} from "@/lib/db/queries";
import type { BackgroundJob } from "@/lib/db/schema";
import { isNightReviewEnabled } from "@/lib/night-review/config";

function jobStatusBadgeClass(status: BackgroundJob["status"]): string {
  switch (status) {
    case "completed":
      return "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400";
    case "failed":
      return "bg-destructive/15 text-destructive";
    case "running":
    case "approving":
      return "bg-amber-500/15 text-amber-800 dark:text-amber-400";
    case "cancelled":
      return "bg-muted text-muted-foreground";
    default:
      return "bg-blue-500/15 text-blue-800 dark:text-blue-300";
  }
}

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
  const [recentRuns, actionableInsightsCount, pendingProposalsCount, jobs] =
    await Promise.all([
      getRecentNightReviewRunsForUser({ userId, limit: 10 }),
      countActionableNightReviewInsights({ userId, since }),
      countPendingProposalsForUser({ userId, since: sinceProposals }),
      listBackgroundJobsForUser({ userId, limit: 30 }),
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
            <div className="flex shrink-0 flex-col gap-2 sm:flex-row sm:items-center">
              <NightReviewTriggerButton
                nightReviewEnabled={nightReviewEnabled}
              />
              <Button asChild variant="secondary">
                <Link href="/night-insights">Open night insights</Link>
              </Button>
            </div>
          </div>

          <dl className="grid gap-3 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-muted-foreground">Scheduling</dt>
              <dd className="font-medium">
                {nightReviewEnabled
                  ? "Enabled (cron → enqueue → QStash → run)"
                  : "Off — set NIGHT_REVIEW_ENABLED=1 for local/preview; production defaults on unless set to 0"}
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
          <div>
            <h2 className="text-lg font-medium">Background jobs</h2>
            <p className="text-muted-foreground text-sm">
              Queued work (goal synthesis, fitness, spending, deep analysis,
              etc.). Open a job for status, audit trail, and memories written
              for that run (
              <code className="rounded bg-muted px-1 py-0.5 font-mono text-xs">
                sourceJobId
              </code>
              ).
            </p>
          </div>
          {jobs.length === 0 ? (
            <p className="text-muted-foreground text-sm">
              No jobs yet. Enqueue work from the app or API (for example{" "}
              <code className="font-mono text-xs">POST /api/jobs</code> or deep
              analysis) and results will show here.
            </p>
          ) : (
            <ul className="divide-y divide-border/60 rounded-lg border border-border/60">
              {jobs.map((job) => (
                <li key={job.id}>
                  <Link
                    className="flex flex-col gap-2 p-4 transition-colors hover:bg-muted/30 sm:flex-row sm:items-center sm:justify-between"
                    href={`/background/jobs/${job.id}`}
                  >
                    <div className="min-w-0 space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono text-sm font-medium">
                          {job.kind}
                        </span>
                        <span
                          className={`rounded-full px-2 py-0.5 text-xs font-medium ${jobStatusBadgeClass(job.status)}`}
                        >
                          {job.status}
                        </span>
                      </div>
                      <p className="text-muted-foreground text-xs">
                        {format(job.createdAt, "MMM d, yyyy HH:mm")}
                        {typeof job.wallTimeMs === "number"
                          ? ` · ${job.wallTimeMs} ms`
                          : ""}
                        {job.proposalCount > 0
                          ? ` · ${job.proposalCount} proposal(s)`
                          : ""}
                      </p>
                    </div>
                    <span className="text-muted-foreground shrink-0 text-sm">
                      View →
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
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
      </div>
    </div>
  );
}
