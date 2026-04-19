import { format } from "date-fns";
import Link from "next/link";
import { NightReviewTriggerButton } from "@/components/night-review-trigger-button";
import { Button } from "@/components/ui/button";
import type { BackgroundJob } from "@/lib/db/schema";

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

export type BackgroundActivitySectionsProps = {
  recentRuns: Array<{
    id: string;
    windowKey: string;
    createdAt: Date;
    outcome: string;
    durationMs: number;
  }>;
  actionableInsightsCount: number;
  pendingProposalsCount: number;
  jobs: BackgroundJob[];
  inProgressAgentTasks: number;
  delegationBacklog: number;
  nightReviewEnabled: boolean;
};

export function BackgroundActivitySections({
  recentRuns,
  actionableInsightsCount,
  pendingProposalsCount,
  jobs,
  inProgressAgentTasks,
  delegationBacklog,
  nightReviewEnabled,
}: BackgroundActivitySectionsProps) {
  const activeBackgroundJobs = jobs.filter(
    (j) => j.status === "running" || j.status === "approving"
  ).length;

  const lastRun = recentRuns[0];

  return (
    <>
      <section className="space-y-4 rounded-xl border border-border/60 bg-card/30 p-6 shadow-[var(--shadow-float)]">
        <div>
          <h2 className="text-lg font-medium">Execution agents &amp; queues</h2>
          <p className="text-muted-foreground text-sm">
            Sub-agent and bridge work: tasks handed to OpenClaw/Hermes/Cursor,
            intents waiting on the delegation queue, and active background jobs.
          </p>
        </div>
        <dl className="grid gap-3 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-muted-foreground">Agent tasks in progress</dt>
            <dd className="font-medium">
              {inProgressAgentTasks}{" "}
              <Link
                className="text-primary text-xs underline-offset-4 hover:underline"
                href="/agent-tasks?status=in_progress"
              >
                View
              </Link>
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Delegation queue (unsent)</dt>
            <dd className="font-medium">{delegationBacklog}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Active background jobs</dt>
            <dd className="font-medium">
              {activeBackgroundJobs}
              {jobs.length > 0 ? (
                <>
                  {" "}
                  <a
                    className="text-primary text-xs underline-offset-4 hover:underline"
                    href="#background-jobs-list"
                  >
                    Jump to list
                  </a>
                </>
              ) : null}
            </dd>
          </div>
        </dl>
      </section>

      <section className="space-y-4 rounded-xl border border-border/60 bg-card/30 p-6 shadow-[var(--shadow-float)]">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="text-lg font-medium">Night review</h2>
            <p className="text-muted-foreground text-sm">
              Scheduled analysis of recent chats. Outputs appear as memories you
              can accept or dismiss on Night insights.
            </p>
          </div>
          <div className="flex shrink-0 flex-col gap-2 sm:flex-row sm:items-center">
            <NightReviewTriggerButton nightReviewEnabled={nightReviewEnabled} />
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
            <dt className="text-muted-foreground">Actionable insights (14d)</dt>
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
                <dd className="font-medium">{outcomeLabel(lastRun.outcome)}</dd>
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

      <section
        className="space-y-4 rounded-xl border border-border/60 bg-card/30 p-6 shadow-[var(--shadow-float)]"
        id="background-jobs-list"
      >
        <div>
          <h2 className="text-lg font-medium">Background jobs</h2>
          <p className="text-muted-foreground text-sm">
            Queued work (goal synthesis, fitness, spending, deep analysis,
            etc.). Open a job for status, audit trail, and memories written for
            that run (
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
              Suggested actions (tier &quot;propose&quot;) from background jobs
              and analysis. Review and accept on the proposals page—nothing runs
              automatically.
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
    </>
  );
}
