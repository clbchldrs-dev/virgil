import { z } from "zod";
import { auth } from "@/app/(auth)/auth";
import { insertSophonTaskForUser } from "@/lib/db/queries";

const postBodySchema = z.object({
  title: z.string().trim().min(1).max(500),
  source: z
    .enum(["manual", "calendar", "existing-task", "memory", "habit"])
    .optional(),
  /** `YYYY-MM-DD` from `<input type="date" />` or empty */
  dueAt: z
    .union([z.string().regex(/^\d{4}-\d{2}-\d{2}$/), z.literal("")])
    .optional(),
  effortFit: z.number().int().min(0).max(100).optional(),
});

function parseDueAt(value: string | undefined): Date | null {
  if (!value || value === "") {
    return null;
  }
  return new Date(`${value}T12:00:00.000Z`);
}

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

  const dueAt = parseDueAt(parsed.data.dueAt);

  const task = await insertSophonTaskForUser({
    userId: session.user.id,
    title: parsed.data.title,
    source: parsed.data.source,
    dueAt,
    effortFit: parsed.data.effortFit,
  });

  return Response.json({ task });
}
