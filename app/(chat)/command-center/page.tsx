import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { auth } from "@/app/(auth)/auth";
import { FlightDeckClient } from "@/app/(chat)/flight-deck/flight-deck-client";
import { SophonDailyClient } from "@/app/(chat)/sophon/sophon-daily-client";
import { BackgroundActivitySections } from "@/components/command-center/background-activity-sections";
import { CommandCenterScrollIntoSection } from "@/components/command-center/command-center-scroll-into-section";
import { CommandCenterSectionNav } from "@/components/command-center/command-center-section-nav";
import { parseCommandCenterSection } from "@/lib/command-center/sections";
import {
  countActionableNightReviewInsights,
  countAgentTasksForUser,
  countDelegationBacklogForUser,
  countPendingProposalsForUser,
  getRecentNightReviewRunsForUser,
  listBackgroundJobsForUser,
} from "@/lib/db/queries";
import { isNightReviewEnabled } from "@/lib/night-review/config";
import { getSophonDailyBriefForUser } from "@/lib/sophon/daily-brief";

export const metadata: Metadata = {
  title: "Command center",
};

export default async function CommandCenterPage({
  searchParams,
}: {
  searchParams: Promise<{ section?: string }>;
}) {
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }

  const { section: sectionQuery } = await searchParams;
  const initialSection = parseCommandCenterSection(sectionQuery);

  const userId = session.user.id;
  const since = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);
  const sinceProposals = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);

  const [
    recentRuns,
    actionableInsightsCount,
    pendingProposalsCount,
    jobs,
    inProgressAgentTasks,
    delegationBacklog,
    brief,
  ] = await Promise.all([
    getRecentNightReviewRunsForUser({ userId, limit: 10 }),
    countActionableNightReviewInsights({ userId, since }),
    countPendingProposalsForUser({ userId, since: sinceProposals }),
    listBackgroundJobsForUser({ userId, limit: 30 }),
    countAgentTasksForUser({ userId, statuses: ["in_progress"] }),
    countDelegationBacklogForUser(userId),
    getSophonDailyBriefForUser(userId),
  ]);

  const nightReviewEnabled = isNightReviewEnabled();

  return (
    <div className="flex min-h-dvh items-start justify-center bg-background p-4 pt-12 md:pt-20">
      <CommandCenterScrollIntoSection section={initialSection} />
      <div className="w-full max-w-4xl space-y-12">
        <header className="space-y-3">
          <div className="space-y-2">
            <h1 className="text-2xl font-semibold tracking-tight">
              Command center
            </h1>
            <p className="text-muted-foreground">
              Triage signals, background jobs and queues, and your daily Sophon
              view—one place for operator workflows.
            </p>
          </div>
          <CommandCenterSectionNav />
        </header>

        <section className="scroll-mt-24 space-y-6" id="command-center-triage">
          <FlightDeckClient embedded />
        </section>

        <section
          className="scroll-mt-24 space-y-6"
          id="command-center-background"
        >
          <div className="space-y-2">
            <h2 className="text-2xl font-semibold tracking-tight">
              Background activity
            </h2>
            <p className="text-muted-foreground">
              Scheduled and asynchronous work: night review, jobs, and execution
              agents. Use{" "}
              <a
                className="text-primary underline-offset-4 hover:underline"
                href="/agent-tasks"
              >
                Agent approvals
              </a>{" "}
              when you need to greenlight tasks for agents—not a human
              checklist.
            </p>
          </div>
          <BackgroundActivitySections
            actionableInsightsCount={actionableInsightsCount}
            delegationBacklog={delegationBacklog}
            inProgressAgentTasks={inProgressAgentTasks}
            jobs={jobs}
            nightReviewEnabled={nightReviewEnabled}
            pendingProposalsCount={pendingProposalsCount}
            recentRuns={recentRuns}
          />
        </section>

        <section className="scroll-mt-24 space-y-6" id="command-center-daily">
          <div className="space-y-2">
            <h2 className="text-2xl font-semibold tracking-tight">
              Daily command center
            </h2>
            <p className="text-muted-foreground">
              Sophon Option B: deterministic Now / Next / Later from your tasks.
              Add priorities below; end-of-day review captures wins, misses, and
              carry-forward.
            </p>
          </div>
          <SophonDailyClient initialBrief={brief} />
        </section>
      </div>
    </div>
  );
}
