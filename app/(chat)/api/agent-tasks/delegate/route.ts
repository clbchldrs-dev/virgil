import { z } from "zod";
import { auth } from "@/app/(auth)/auth";
import { delegateApprovedAgentTask } from "@/lib/agent-tasks/delegate-approved-task";

const bodySchema = z.object({
  id: z.string().uuid(),
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

  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: "invalid body" }, { status: 400 });
  }

  const result = await delegateApprovedAgentTask({
    userId: session.user.id,
    taskId: parsed.data.id,
  });

  if (!result.ok) {
    const status =
      result.code === "not_found"
        ? 404
        : result.code === "bad_status"
          ? 409
          : result.code === "not_configured"
            ? 400
            : result.code === "preflight_failed"
              ? 422
              : 500;
    return Response.json(
      { error: result.message, code: result.code, intentId: result.intentId },
      { status }
    );
  }

  return Response.json({
    task: result.task,
    delegation: result.outcome,
    intentId: result.intentId,
  });
}
