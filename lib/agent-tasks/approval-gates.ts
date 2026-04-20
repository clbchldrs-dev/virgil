import { resolveAgentTaskImpactTier } from "@/lib/agent-tasks/impact-tier";
import type { AgentTask } from "@/lib/db/schema";

function hasOutOfBandAcknowledgment(
  metadata: Record<string, unknown>
): boolean {
  const raw = metadata.outOfBandAcknowledgedAt;
  return typeof raw === "string" && raw.trim().length > 0;
}

/**
 * When transitioning to `approved`, returns an error message if tier rules block
 * the transition; otherwise `null`.
 */
export function getAgentTaskApprovalBlockMessage(
  task: AgentTask,
  options: {
    nextStatus: string;
    githubAgentTasksConfigured: boolean;
    /** True when the PATCH body includes explicit out-of-band acknowledgment (no GitHub). */
    outOfBandReviewAcknowledged: boolean;
  }
): string | null {
  if (options.nextStatus !== "approved") {
    return null;
  }

  const tier = resolveAgentTaskImpactTier({
    taskType: task.taskType,
    priority: task.priority,
    metadata: task.metadata,
  });
  if (tier !== "elevated") {
    return null;
  }

  const meta = (task.metadata ?? {}) as Record<string, unknown>;

  if (options.githubAgentTasksConfigured) {
    if (!task.githubIssueUrl?.trim()) {
      return "This high-impact task needs a linked GitHub issue before approval. Ensure GitHub integration created an issue when the task was submitted, or fix GitHub configuration.";
    }
    return null;
  }

  if (options.outOfBandReviewAcknowledged || hasOutOfBandAcknowledgment(meta)) {
    return null;
  }

  return "Confirm out-of-band review (checkbox) before approving this high-impact task.";
}
