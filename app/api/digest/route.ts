import { Resend } from "resend";
import { getRecentMemories } from "@/lib/db/queries";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { user } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

const resend = new Resend(process.env.RESEND_API_KEY);
const client = postgres(process.env.POSTGRES_URL ?? "");
const db = drizzle(client);

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  const owners = await db
    .select()
    .from(user)
    .where(eq(user.isAnonymous, false));

  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);

  for (const owner of owners) {
    if (owner.email.startsWith("guest-")) continue;

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
  }

  return new Response("OK", { status: 200 });
}
