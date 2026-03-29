import { Resend } from "resend";
import { getRecentMemories, getOwnerUsers } from "@/lib/db/queries";

const resend = new Resend(process.env.RESEND_API_KEY);

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  const owners = await getOwnerUsers();
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);

  for (const owner of owners) {
    if (owner.email.startsWith("guest-")) continue;

    try {
      const memories = await getRecentMemories({
        userId: owner.id,
        since,
        limit: 20,
      });

      if (memories.length === 0) continue;

      const grouped = {
        goals: memories.filter((m) => m.kind === "goal"),
        opportunities: memories.filter((m) => m.kind === "opportunity"),
        notes: memories.filter((m) => m.kind === "note"),
        facts: memories.filter((m) => m.kind === "fact"),
      };

      const sections: string[] = [];

      if (grouped.goals.length > 0) {
        sections.push(
          "Goals:\n" + grouped.goals.map((m) => `  - ${m.content}`).join("\n")
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
          "Notes:\n" + grouped.notes.map((m) => `  - ${m.content}`).join("\n")
        );
      }
      if (grouped.facts.length > 0) {
        sections.push(
          "Things I learned about you:\n" +
            grouped.facts.map((m) => `  - ${m.content}`).join("\n")
        );
      }

      const body = `Here's what we covered in the last 24 hours:\n\n${sections.join("\n\n")}\n\nHave a good day.`;

      await resend.emails.send({
        from: "Assistant <onboarding@resend.dev>",
        to: owner.email,
        subject: `Your daily digest — ${new Date().toLocaleDateString()}`,
        text: body,
      });
    } catch (error) {
      console.error(`Digest failed for user ${owner.id}:`, error);
    }
  }

  return new Response("OK", { status: 200 });
}
