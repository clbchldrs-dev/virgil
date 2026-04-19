import { Resend } from "resend";
import { auth } from "@/app/(auth)/auth";
import {
  countPendingProposalsForUser,
  getFlightDeckActionByRequestId,
  getFlightDeckActionByToken,
  getLatestFlightDeckAction,
  getProposalMemoriesForUser,
  getRecentMemories,
  getUsersEligibleForCompanionBackgroundJobs,
  hasFlightDeckActionInProgress,
  insertFlightDeckActionStart,
  updateFlightDeckActionStatus,
} from "@/lib/db/queries";
import { postDailyDigestToSlack } from "@/lib/integrations/slack-checkin";
import { handleDigestGet } from "@/lib/reliability/digest-route-handler";
import { handleRunDigestAction } from "@/lib/reliability/flight-deck-actions-handler";

function getResend() {
  return new Resend(process.env.RESEND_API_KEY);
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return Response.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const requestOrigin = new URL(request.url).origin;

  return handleRunDigestAction(
    request,
    {
      now: () => new Date(),
      isAllowedRole: (role) => role === "operator" || role === "admin",
      getActionByRequestId: (input) => getFlightDeckActionByRequestId(input),
      getActionByToken: (input) => getFlightDeckActionByToken(input),
      hasInProgressAction: (input) => hasFlightDeckActionInProgress(input),
      getLatestAction: (input) => getLatestFlightDeckAction(input),
      insertActionStart: (input) => insertFlightDeckActionStart(input),
      updateActionStatus: (input) => updateFlightDeckActionStatus(input),
      executeDigest: async () => {
        const cronSecret = process.env.CRON_SECRET;
        if (!cronSecret) {
          return {
            ok: false,
            message: "CRON_SECRET is not configured.",
          };
        }

        const appOrigin =
          process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ?? requestOrigin;
        const digestRequest = new Request(`${appOrigin}/api/digest`, {
          method: "GET",
          headers: {
            authorization: `Bearer ${cronSecret}`,
          },
        });

        const response = await handleDigestGet(digestRequest, {
          cronSecret,
          appOrigin,
          now: () => new Date(),
          getOwners: getUsersEligibleForCompanionBackgroundJobs,
          getRecentMemories,
          countPendingProposals: countPendingProposalsForUser,
          getProposalMemories: getProposalMemoriesForUser,
          sendEmail: async ({ to, subject, text }) => {
            await getResend().emails.send({
              from: "Assistant <onboarding@resend.dev>",
              to,
              subject,
              text,
            });
          },
          postSlack: postDailyDigestToSlack,
        });

        const payload = (await response.json().catch(() => ({}))) as {
          ok?: boolean;
          summary?: Record<string, unknown>;
          failures?: Record<string, unknown>[];
        };

        if (!response.ok || payload.ok !== true) {
          return {
            ok: false,
            message: "Digest route returned a non-success result.",
            details: {
              status: response.status,
              payload,
            },
          };
        }

        return {
          ok: true,
          message: "Digest run completed.",
          details: {
            status: response.status,
            summary: payload.summary ?? {},
            failures: payload.failures ?? [],
          },
        };
      },
    },
    {
      userId: session.user.id,
      role: session.user.role,
      requestOrigin,
    }
  );
}
