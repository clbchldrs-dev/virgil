import { auth } from "@/app/(auth)/auth";
import {
  countActionableNightReviewInsights,
  countActiveBackgroundJobsForUser,
  countPendingProposalsForUser,
} from "@/lib/db/queries";

/**
 * Compact counts for empty-chat pills (night insights, background jobs, proposals).
 * Guests get zeros so the UI does not branch on auth.
 */
export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return Response.json({ night: 0, jobs: 0, proposals: 0 });
  }

  const userId = session.user.id;
  const sinceNight = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);
  const sinceProposals = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);

  const [night, proposals, jobs] = await Promise.all([
    countActionableNightReviewInsights({ userId, since: sinceNight }),
    countPendingProposalsForUser({ userId, since: sinceProposals }),
    countActiveBackgroundJobsForUser({ userId }),
  ]);

  return Response.json({ night, jobs, proposals });
}
