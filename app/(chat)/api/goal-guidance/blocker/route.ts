import { z } from "zod";
import { auth } from "@/app/(auth)/auth";
import { saveBlockerIncident } from "@/lib/db/queries";

const postBodySchema = z.object({
  blockerKey: z.string().min(1).max(128),
  summary: z.string().min(1),
  triggerGuess: z.string().optional(),
  mitigationNote: z.string().optional(),
  chatId: z.string().uuid().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
  occurredAt: z.string().datetime().optional(),
});

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "invalid json" }, { status: 400 });
  }

  const parsed = postBodySchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: "invalid body" }, { status: 400 });
  }

  const incident = await saveBlockerIncident({
    userId: session.user.id,
    chatId: parsed.data.chatId,
    blockerKey: parsed.data.blockerKey,
    summary: parsed.data.summary,
    triggerGuess: parsed.data.triggerGuess,
    mitigationNote: parsed.data.mitigationNote,
    metadata: parsed.data.metadata,
    occurredAt: parsed.data.occurredAt
      ? new Date(parsed.data.occurredAt)
      : undefined,
  });

  return Response.json({ incident });
}
