/**
 * Impact tier for agent tasks (approval policy).
 *
 * **Elevated** tasks need an extra checkpoint before `approved` (GitHub issue URL when
 * GitHub integration is configured, or explicit out-of-band acknowledgment otherwise).
 *
 * Rules (adjust here only):
 * - `infra` task type → elevated
 * - `critical` priority → elevated
 * - `high` priority + (`feature` or `bug`) → elevated
 * - Optional `metadata.impactTierOverride`: `"standard"` | `"elevated"` wins when set
 */

export type AgentTaskImpactTier = "standard" | "elevated";

export type AgentTaskTypeForTier =
  | "bug"
  | "feature"
  | "refactor"
  | "prompt"
  | "docs"
  | "infra";

export type AgentTaskPriorityForTier = "low" | "medium" | "high" | "critical";

export type ResolveAgentTaskImpactTierInput = {
  taskType: AgentTaskTypeForTier;
  priority: AgentTaskPriorityForTier;
  metadata?: Record<string, unknown> | null;
};

function isOverride(v: unknown): v is AgentTaskImpactTier {
  return v === "standard" || v === "elevated";
}

export function resolveAgentTaskImpactTier(
  input: ResolveAgentTaskImpactTierInput
): AgentTaskImpactTier {
  const raw = input.metadata?.impactTierOverride;
  if (isOverride(raw)) {
    return raw;
  }

  if (input.taskType === "infra") {
    return "elevated";
  }
  if (input.priority === "critical") {
    return "elevated";
  }
  if (
    input.priority === "high" &&
    (input.taskType === "feature" || input.taskType === "bug")
  ) {
    return "elevated";
  }
  return "standard";
}
