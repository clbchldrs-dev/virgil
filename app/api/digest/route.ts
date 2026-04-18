import { Resend } from "resend";
import {
  countPendingProposalsForUser,
  getProposalMemoriesForUser,
  getRecentMemories,
  getUsersEligibleForCompanionBackgroundJobs,
} from "@/lib/db/queries";
import { postDailyDigestToSlack } from "@/lib/integrations/slack-checkin";
import { handleDigestGet } from "@/lib/reliability/digest-route-handler";

function getResend() {
  return new Resend(process.env.RESEND_API_KEY);
}

export function GET(request: Request) {
  return handleDigestGet(request, {
    cronSecret: process.env.CRON_SECRET,
    appOrigin:
      process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ??
      "http://localhost:3000",
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
}
