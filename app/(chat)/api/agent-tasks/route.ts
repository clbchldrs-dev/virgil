import { z } from "zod";
import { auth } from "@/app/(auth)/auth";
import { getAgentTaskApprovalBlockMessage } from "@/lib/agent-tasks/approval-gates";
import { resolveAgentTaskImpactTier } from "@/lib/agent-tasks/impact-tier";
import {
  getAgentTaskById,
  listAgentTasks,
  updateAgentTaskStatus,
} from "@/lib/db/queries";
import { isAgentTaskGitHubConfigured } from "@/lib/github/agent-task-issue";

const patchBodySchema = z.object({
  id: z.string().uuid(),
  status: z.enum(["submitted", "approved", "in_progress", "done", "rejected"]),
  agentNotes: z.string().optional(),
  completionSummary: z.string().max(8000).optional(),
  outOfBandReviewAcknowledged: z.boolean().optional(),
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

  const existing = await getAgentTaskById({ id: parsed.data.id });
  if (!existing || existing.userId !== session.user.id) {
    return Response.json({ error: "task not found" }, { status: 404 });
  }

  const githubConfigured = isAgentTaskGitHubConfigured();
  const block = getAgentTaskApprovalBlockMessage(existing, {
    nextStatus: parsed.data.status,
    githubAgentTasksConfigured: githubConfigured,
    outOfBandReviewAcknowledged:
      parsed.data.outOfBandReviewAcknowledged === true,
  });
  if (block) {
    return Response.json({ error: block }, { status: 400 });
  }

  const metadataMerge: Record<string, unknown> = {};

  if (
    parsed.data.status === "approved" &&
    parsed.data.outOfBandReviewAcknowledged === true &&
    !githubConfigured
  ) {
    const tier = resolveAgentTaskImpactTier({
      taskType: existing.taskType,
      priority: existing.priority,
      metadata: existing.metadata,
    });
    if (tier === "elevated") {
      metadataMerge.outOfBandAcknowledgedAt = new Date().toISOString();
    }
  }

  if (
    parsed.data.status === "done" &&
    parsed.data.completionSummary !== undefined
  ) {
    const s = parsed.data.completionSummary.trim();
    if (s.length > 0) {
      metadataMerge.completionSummary = s;
    }
  }

  const task = await updateAgentTaskStatus({
    id: parsed.data.id,
    userId: session.user.id,
    status: parsed.data.status,
    agentNotes: parsed.data.agentNotes,
    metadataMerge:
      Object.keys(metadataMerge).length > 0 ? metadataMerge : undefined,
  });

  if (!task) {
    return Response.json({ error: "task not found" }, { status: 404 });
  }

  return Response.json({ task });
}
