import { Resend } from "resend";
import {
  countPendingProposalsForUser,
  getProposalMemoriesForUser,
  getRecentMemories,
  getUsersEligibleForCompanionBackgroundJobs,
} from "@/lib/db/queries";
import { postDailyDigestToSlack } from "@/lib/integrations/slack-checkin";

function getResend() {
  return new Resend(process.env.RESEND_API_KEY);
}

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  const owners = await getUsersEligibleForCompanionBackgroundJobs();
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const sinceProposals = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
  const appOrigin =
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ??
    "http://localhost:3000";

  for (const owner of owners) {
    if (owner.email.startsWith("guest-")) {
      continue;
    }

    try {
      const [memories, pendingProposalCount] = await Promise.all([
        getRecentMemories({
          userId: owner.id,
          since,
          limit: 20,
        }),
        countPendingProposalsForUser({
          userId: owner.id,
          since: sinceProposals,
        }),
      ]);

      if (memories.length === 0 && pendingProposalCount === 0) {
        continue;
      }

      const grouped = {
        goals: memories.filter((m) => m.kind === "goal"),
        opportunities: memories.filter((m) => m.kind === "opportunity"),
        notes: memories.filter((m) => m.kind === "note"),
        facts: memories.filter((m) => m.kind === "fact"),
      };

      const sections: string[] = [];

      if (pendingProposalCount > 0) {
        const preview = await getProposalMemoriesForUser({
          userId: owner.id,
          since: sinceProposals,
          limit: 5,
        });
        const lines = preview.map((m) => {
          const line = m.content.replace(/\s+/g, " ").trim();
          const short = line.length > 220 ? `${line.slice(0, 220)}…` : line;
          return `  - ${short}`;
        });
        sections.push(
          `Pending proposals (${pendingProposalCount} in the last 90 days — review in app):\n${lines.join("\n")}\n\nOpen proposals: ${appOrigin}/proposals`
        );
      }

      if (grouped.goals.length > 0) {
        sections.push(
          `Goals:\n${grouped.goals.map((m) => `  - ${m.content}`).join("\n")}`
        );
      }
      if (grouped.opportunities.length > 0) {
        sections.push(
          "Opportunities:\n" +
            grouped.opportunities.map((m) => `  - ${m.content}`).join("\n")
        );
      }
      if (grouped.notes.length > 0) {
        sections.push(
          `Notes:\n${grouped.notes.map((m) => `  - ${m.content}`).join("\n")}`
        );
      }
      if (grouped.facts.length > 0) {
        sections.push(
          "Things I learned about you:\n" +
            grouped.facts.map((m) => `  - ${m.content}`).join("\n")
        );
      }

      const intro =
        memories.length > 0
          ? "Here's what we covered in the last 24 hours:"
          : "Daily check-in from Virgil:";
      const body = `${intro}\n\n${sections.join("\n\n")}\n\nHave a good day.`;

      try {
        await getResend().emails.send({
          from: "Assistant <onboarding@resend.dev>",
          to: owner.email,
          subject: `Your daily digest — ${new Date().toLocaleDateString()}`,
          text: body,
        });
      } catch (emailError) {
        console.error(`Digest email failed for user ${owner.id}:`, emailError);
      }

      const slack = await postDailyDigestToSlack(body);
      if (!slack.ok) {
        console.error(
          `Digest Slack mirror failed for user ${owner.id}:`,
          slack.error
        );
      }
    } catch (error) {
      console.error(`Digest failed for user ${owner.id}:`, error);
    }
  }

  return new Response("OK", { status: 200 });
}
