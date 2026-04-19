import { format } from "date-fns";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/app/(auth)/auth";
import { Button } from "@/components/ui/button";
import {
  getBackgroundJobForUser,
  getJobAuditTrail,
  getMemoriesBySourceJobId,
} from "@/lib/db/queries";
import type { BackgroundJob } from "@/lib/db/schema";
import { JobCancelButton } from "./job-cancel-button";

function statusBadgeClass(status: BackgroundJob["status"]): string {
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

export default async function BackgroundJobDetailPage({
  params,
}: {
  params: Promise<{ jobId: string }>;
}) {
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }

  const { jobId } = await params;
  const userId = session.user.id;

  const job = await getBackgroundJobForUser({ id: jobId, userId });
  if (!job) {
    notFound();
  }

  const [auditTrail, proposals] = await Promise.all([
    getJobAuditTrail(jobId),
    getMemoriesBySourceJobId({ userId, jobId }),
  ]);

  const proposeRows = proposals.filter((m) => m.tier === "propose");
  const observeRows = proposals.filter((m) => m.tier !== "propose");

  return (
    <div className="flex min-h-dvh items-start justify-center bg-background p-4 pt-12 md:pt-20">
      <div className="w-full max-w-3xl space-y-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-2">
            <p className="text-muted-foreground text-sm">
              <Link
                className="text-foreground underline-offset-4 hover:underline"
                href="/command-center?section=background"
              >
                Command center
              </Link>
              <span aria-hidden="true"> / </span>
              <span className="text-foreground">Job</span>
            </p>
            <h1 className="font-mono text-xl font-semibold tracking-tight">
              {job.kind}
            </h1>
            <p className="text-muted-foreground font-mono text-xs">{job.id}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`rounded-full px-3 py-1 text-xs font-medium ${statusBadgeClass(job.status)}`}
            >
              {job.status}
            </span>
            {job.status === "pending" ? (
              <JobCancelButton jobId={job.id} />
            ) : null}
          </div>
        </div>

        <section className="space-y-3 rounded-xl border border-border/60 bg-card/30 p-6 shadow-[var(--shadow-float)]">
          <h2 className="text-lg font-medium">Summary</h2>
          <dl className="grid gap-3 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-muted-foreground">Created</dt>
              <dd className="font-medium">
                {format(job.createdAt, "MMM d, yyyy HH:mm")}
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Updated</dt>
              <dd className="font-medium">
                {format(job.updatedAt, "MMM d, yyyy HH:mm")}
              </dd>
            </div>
            {job.startedAt ? (
              <div>
                <dt className="text-muted-foreground">Started</dt>
                <dd className="font-medium">
                  {format(job.startedAt, "MMM d, yyyy HH:mm")}
                </dd>
              </div>
            ) : null}
            {job.completedAt ? (
              <div>
                <dt className="text-muted-foreground">Completed</dt>
                <dd className="font-medium">
                  {format(job.completedAt, "MMM d, yyyy HH:mm")}
                </dd>
              </div>
            ) : null}
            <div>
              <dt className="text-muted-foreground">Wall time</dt>
              <dd className="font-medium">
                {typeof job.wallTimeMs === "number"
                  ? `${job.wallTimeMs} ms`
                  : "—"}
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Proposal count</dt>
              <dd className="font-medium">{job.proposalCount}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Retries</dt>
              <dd className="font-medium">{job.retryCount}</dd>
            </div>
          </dl>
          {job.error ? (
            <div className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm">
              <p className="text-destructive font-medium">Error</p>
              <p className="mt-1 whitespace-pre-wrap">{job.error}</p>
            </div>
          ) : null}
        </section>

        {job.result && Object.keys(job.result).length > 0 ? (
          <section className="space-y-3 rounded-xl border border-border/60 bg-card/30 p-6 shadow-[var(--shadow-float)]">
            <h2 className="text-lg font-medium">Result</h2>
            <pre className="max-h-80 overflow-auto rounded-md border border-border/60 bg-muted/30 p-3 font-mono text-xs leading-relaxed">
              {JSON.stringify(job.result, null, 2)}
            </pre>
          </section>
        ) : null}

        <section className="space-y-3 rounded-xl border border-border/60 bg-card/30 p-6 shadow-[var(--shadow-float)]">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h2 className="text-lg font-medium">Proposals &amp; insights</h2>
              <p className="text-muted-foreground text-sm">
                Rows written for this job (same data as{" "}
                <code className="rounded bg-muted px-1 py-0.5 font-mono text-xs">
                  GET /api/jobs/[jobId]
                </code>
                ). Tier &quot;propose&quot; items also appear on{" "}
                <Link
                  className="text-foreground underline-offset-4 hover:underline"
                  href="/proposals"
                >
                  Proposals
                </Link>
                .
              </p>
            </div>
            <Button asChild size="sm" variant="secondary">
              <Link href="/proposals">Open proposals</Link>
            </Button>
          </div>
          {proposals.length === 0 ? (
            <p className="text-muted-foreground text-sm">
              No memory rows linked to this job yet (metadata{" "}
              <code className="font-mono text-xs">sourceJobId</code>), or the
              job did not persist insights.
            </p>
          ) : (
            <ul className="space-y-4">
              {proposeRows.length > 0 ? (
                <li>
                  <p className="text-muted-foreground mb-2 text-xs font-medium uppercase tracking-wide">
                    Propose ({proposeRows.length})
                  </p>
                  <ul className="space-y-2">
                    {proposeRows.map((m) => (
                      <li
                        className="rounded-md border border-border/60 bg-muted/20 p-3 text-sm"
                        key={m.id}
                      >
                        <p className="text-muted-foreground font-mono text-xs">
                          {m.id}
                        </p>
                        <p className="mt-1">{m.content}</p>
                      </li>
                    ))}
                  </ul>
                </li>
              ) : null}
              {observeRows.length > 0 ? (
                <li>
                  <p className="text-muted-foreground mb-2 text-xs font-medium uppercase tracking-wide">
                    Observe ({observeRows.length})
                  </p>
                  <ul className="space-y-2">
                    {observeRows.map((m) => (
                      <li
                        className="rounded-md border border-border/60 bg-muted/10 p-3 text-sm"
                        key={m.id}
                      >
                        <p className="text-muted-foreground font-mono text-xs">
                          {m.id}
                        </p>
                        <p className="mt-1">{m.content}</p>
                      </li>
                    ))}
                  </ul>
                </li>
              ) : null}
            </ul>
          )}
        </section>

        <section className="space-y-3 rounded-xl border border-border/60 bg-card/30 p-6 shadow-[var(--shadow-float)]">
          <h2 className="text-lg font-medium">Audit trail</h2>
          {auditTrail.length === 0 ? (
            <p className="text-muted-foreground text-sm">
              No status transitions logged yet.
            </p>
          ) : (
            <ul className="space-y-2 text-sm">
              {auditTrail.map((row, index) => (
                <li
                  className="flex flex-wrap items-baseline justify-between gap-2 border-b border-border/40 pb-2 last:border-0 last:pb-0"
                  key={`${row.createdAt.toISOString()}-${row.oldStatus}-${row.newStatus}-${String(index)}`}
                >
                  <span>
                    <span className="font-mono text-xs">{row.oldStatus}</span>
                    <span className="text-muted-foreground px-1">→</span>
                    <span className="font-mono text-xs">{row.newStatus}</span>
                    {row.reason ? (
                      <span className="text-muted-foreground">
                        {" "}
                        — {row.reason}
                      </span>
                    ) : null}
                  </span>
                  <span className="text-muted-foreground text-xs">
                    {format(row.createdAt, "MMM d HH:mm:ss")}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
