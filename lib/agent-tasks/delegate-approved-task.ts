import "server-only";

import {
  countDelegationBacklogForUser,
  getAgentTaskById,
  queuePendingIntent,
  trySendPendingIntentById,
  updateAgentTaskDelegatedSnapshot,
} from "@/lib/db/queries";
import type { AgentTask } from "@/lib/db/schema";
import {
  buildDelegationQueuedSuccess,
  buildDelegationSendOutcome,
  buildDelegationSkipFailure,
  type DelegationOutcome,
} from "@/lib/integrations/delegation-errors";
import {
  delegationListSkillNamesUnion,
  delegationPing,
  getDelegationProvider,
  isDelegationConfigured,
} from "@/lib/integrations/delegation-provider";
import {
  delegationNeedsConfirmation,
  matchSkillFromDescription,
} from "@/lib/integrations/openclaw-match";
import type { ClawIntent } from "@/lib/integrations/openclaw-types";

export type DelegateApprovedAgentTaskErrorCode =
  | "not_configured"
  | "not_found"
  | "bad_status"
  | "update_failed";

function summarizeOutcomeForMetadata(
  outcome: DelegationOutcome
): Record<string, unknown> {
  if (outcome.ok) {
    return {
      ok: true,
      status: outcome.status,
      backend: outcome.backend,
      intentId: outcome.intentId,
    };
  }
  return {
    ok: false,
    error: outcome.error,
    backend: outcome.backend,
    intentId: outcome.intentId,
    message: outcome.message,
  };
}

export async function delegateApprovedAgentTask({
  userId,
  taskId,
}: {
  userId: string;
  taskId: string;
}): Promise<
  | {
      ok: true;
      task: AgentTask;
      outcome: DelegationOutcome;
      intentId: string;
    }
  | {
      ok: false;
      code: DelegateApprovedAgentTaskErrorCode;
      message: string;
      intentId?: string;
    }
> {
  if (!isDelegationConfigured()) {
    return {
      ok: false,
      code: "not_configured",
      message:
        "Delegation is not configured. Set Hermes or OpenClaw URLs (see AGENTS.md and docs/openclaw-bridge.md).",
    };
  }

  const task = await getAgentTaskById({ id: taskId });
  if (!task || task.userId !== userId) {
    return { ok: false, code: "not_found", message: "Task not found." };
  }
  if (task.status !== "approved") {
    return {
      ok: false,
      code: "bad_status",
      message: "Only approved tasks can be delegated.",
    };
  }

  const delegationProvider = getDelegationProvider();
  const backend = delegationProvider.backend;
  const skills = await delegationListSkillNamesUnion();
  const fullDescription = `${task.title}\n\n${task.description}`.trim();
  const resolvedSkill =
    matchSkillFromDescription(fullDescription, skills) ?? "generic-task";
  const needsConfirm = delegationNeedsConfirmation(
    fullDescription,
    resolvedSkill
  );

  const mergedParams: Record<string, unknown> = {
    description: fullDescription,
    virgilLane: "code",
    agentTaskId: task.id,
    taskType: task.taskType,
    title: task.title,
    metadata: task.metadata,
  };

  const priority: ClawIntent["priority"] =
    task.priority === "critical" || task.priority === "high"
      ? "high"
      : "normal";

  const intent: ClawIntent = {
    skill: resolvedSkill,
    params: mergedParams,
    priority,
    source: "agent-task",
    requiresConfirmation: needsConfirm,
  };

  const row = await queuePendingIntent({
    userId,
    chatId: task.chatId ?? undefined,
    intent,
    skill: resolvedSkill,
    requiresConfirmation: needsConfirm,
  });

  const online = await delegationPing();

  let outcome: DelegationOutcome;

  if (!online) {
    const backlog = await countDelegationBacklogForUser(userId);
    const failure = buildDelegationSkipFailure({
      reason: "backend_offline",
      backend,
      queuedBacklog: backlog,
    });
    outcome = { ...failure, intentId: row.id };
  } else if (needsConfirm) {
    outcome = buildDelegationQueuedSuccess({
      backend,
      intentId: row.id,
      message:
        "Queued for delegation. Confirm the pending intent before it is sent to the execution agent.",
    });
  } else {
    const sendResult = await trySendPendingIntentById({
      id: row.id,
      userId,
    });
    if (sendResult.skipped) {
      const backlog =
        sendResult.reason === "backend_offline"
          ? await countDelegationBacklogForUser(userId)
          : 0;
      const failure = buildDelegationSkipFailure({
        reason: sendResult.reason,
        backend,
        queuedBacklog: backlog,
      });
      outcome = { ...failure, intentId: row.id };
    } else {
      outcome = buildDelegationSendOutcome({
        backend,
        intentId: row.id,
        result: sendResult.result,
      });
    }
  }

  const updated = await updateAgentTaskDelegatedSnapshot({
    id: taskId,
    userId,
    intentId: row.id,
    backend,
    outcomeSummary: summarizeOutcomeForMetadata(outcome),
  });

  if (!updated) {
    return {
      ok: false,
      code: "update_failed",
      message:
        "Delegation was queued but the task could not be updated. Check pending intents.",
      intentId: row.id,
    };
  }

  return { ok: true, task: updated, outcome, intentId: row.id };
}
