import { z } from "zod";
import { auth } from "@/app/(auth)/auth";
import { listAgentTasks, updateAgentTaskStatus } from "@/lib/db/queries";

const patchBodySchema = z.object({
  id: z.string().uuid(),
  status: z.enum(["submitted", "approved", "in_progress", "done", "rejected"]),
  agentNotes: z.string().optional(),
});

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status") as
    | "submitted"
    | "approved"
    | "in_progress"
    | "done"
    | "rejected"
    | null;

  const rawLimit = Number.parseInt(searchParams.get("limit") ?? "50", 10);
  const limit = Math.min(Number.isFinite(rawLimit) ? rawLimit : 50, 200);

  const tasks = await listAgentTasks({
    userId: session.user.id,
    status: status ?? undefined,
    limit,
  });

  return Response.json({ tasks });
}

export async function PATCH(request: Request) {
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

  const parsed = patchBodySchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: "invalid body" }, { status: 400 });
  }

  const task = await updateAgentTaskStatus({
    id: parsed.data.id,
    userId: session.user.id,
    status: parsed.data.status,
    agentNotes: parsed.data.agentNotes,
  });

  if (!task) {
    return Response.json({ error: "task not found" }, { status: 404 });
  }

  return Response.json({ task });
}
