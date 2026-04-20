import { isJiraConfigured } from "@/lib/ai/tools/jira";
import type { DelegationDeploymentSnapshot } from "@/lib/deployment/delegation-snapshot";
import { getDelegationDeploymentSnapshot } from "@/lib/deployment/delegation-snapshot";

/**
 * Tool ids active for this process — must stay aligned with
 * `getCompanionTools()` in `lib/ai/tools/companion.ts` (same gating; avoid
 * importing companion here because its graph pulls `server-only` modules).
 */
function getActiveCompanionToolIds(): string[] {
  const onVercel = Boolean(process.env.VERCEL);
  const jira = isJiraConfigured()
    ? (["getJiraIssue", "searchJiraIssues", "updateJiraIssue"] as const)
    : ([] as const);
  const universal = ["getBriefing", "listCalendarEvents"] as const;
  const localOnly = onVercel
    ? ([] as const)
    : (["readFile", "writeFile", "executeShell"] as const);
  return [...universal, ...jira, ...localOnly];
}

/** Read-only env hints for operator surfaces (no secrets). */
export type AgentTaskOrchestrationHints = {
  triageEnabled: boolean;
  multiAgentPlannerEnabled: boolean;
  /** Number of planner models when `VIRGIL_MULTI_AGENT_PLANNER_CHAIN` is set; else 1 when multi-agent is on. */
  plannerStageCount: number | null;
};

export type DeploymentCapabilities = {
  generatedAt: string;
  /** Where this server process is running. */
  environment: "vercel" | "local" | "unknown";
  localInference: {
    available: boolean;
    detail: string;
  };
  hostedInference: {
    available: boolean;
    detail: string;
  };
  agentTools: Array<{
    id: string;
    label: string;
    available: boolean;
    detail?: string;
  }>;
  /** Agent tasks + gateway planner flags derived from env (user-safe). */
  agentTaskOrchestration: AgentTaskOrchestrationHints;
  /** Hermes/OpenClaw delegation — present when using async builder. */
  delegation?: DelegationDeploymentSnapshot | null;
};

const TOOL_LABELS: Record<string, string> = {
  getBriefing: "Workspace briefing",
  listCalendarEvents: "Calendar",
  readFile: "Read files in workspace",
  writeFile: "Write files in workspace",
  executeShell: "Run shell commands",
  getJiraIssue: "Jira: get issue",
  searchJiraIssues: "Jira: search",
  updateJiraIssue: "Jira: update issue",
};

function toolLabel(id: string): string {
  return TOOL_LABELS[id] ?? id;
}

function isVercelRuntime(): boolean {
  return Boolean(process.env.VERCEL);
}

/**
 * Env-only snapshot for `/agent-tasks` and deployment UI. No network I/O.
 */
export function getAgentTaskOrchestrationHints(): AgentTaskOrchestrationHints {
  const triageRaw = process.env.AGENT_TASK_TRIAGE_ENABLED?.trim().toLowerCase();
  const triageEnabled =
    triageRaw === "1" || triageRaw === "true" || triageRaw === "yes";
  const multiRaw = process.env.VIRGIL_MULTI_AGENT_ENABLED?.trim().toLowerCase();
  const multiAgentPlannerEnabled =
    multiRaw === "1" || multiRaw === "true" || multiRaw === "yes";
  const chain = process.env.VIRGIL_MULTI_AGENT_PLANNER_CHAIN?.trim();
  let plannerStageCount: number | null = null;
  if (chain) {
    const n = chain
      .split(",")
      .map((s) => s.trim())
      .filter((s) => s.length > 0).length;
    plannerStageCount = n > 0 ? n : null;
  } else if (multiAgentPlannerEnabled) {
    plannerStageCount = 1;
  }
  return {
    triageEnabled,
    multiAgentPlannerEnabled,
    plannerStageCount,
  };
}

function hasHostedGateway(): boolean {
  return Boolean(
    process.env.AI_GATEWAY_API_KEY?.trim() ||
      process.env.VERCEL_OIDC_TOKEN?.trim()
  );
}

const LOCAL_ONLY_TOOL_IDS = new Set(["readFile", "writeFile", "executeShell"]);

const JIRA_TOOL_IDS = new Set([
  "getJiraIssue",
  "searchJiraIssues",
  "updateJiraIssue",
]);

/** All companion tool ids the product may expose; order is stable for UI. */
const CANONICAL_COMPANION_TOOL_IDS = [
  "getBriefing",
  "listCalendarEvents",
  "readFile",
  "writeFile",
  "executeShell",
  "getJiraIssue",
  "searchJiraIssues",
  "updateJiraIssue",
] as const;

/**
 * User-safe snapshot (sync portion only — no delegation probe). Prefer
 * {@link buildDeploymentCapabilities} for the full JSON including delegation.
 */
export function buildDeploymentCapabilitiesSync(): DeploymentCapabilities {
  const generatedAt = new Date().toISOString();
  const onVercel = isVercelRuntime();
  const environment: DeploymentCapabilities["environment"] = onVercel
    ? "vercel"
    : "local";

  const hostedOk = hasHostedGateway();
  const hostedInference = {
    available: hostedOk,
    detail: hostedOk
      ? "Cloud models can use the AI Gateway (or Vercel OIDC) from this deployment."
      : "Cloud models need AI_GATEWAY_API_KEY or VERCEL_OIDC_TOKEN on this deployment.",
  };

  const localInference = onVercel
    ? {
        available: false,
        detail:
          "Local Ollama runs on your machine or LAN. Hosted serverless cannot reach private Ollama; use cloud models or self-host the app where Ollama is reachable.",
      }
    : {
        available: true,
        detail:
          "This process can use Ollama when it is running and models are pulled (see project docs).",
      };

  const activeNames = new Set(getActiveCompanionToolIds());
  const jiraOk = isJiraConfigured();

  const agentTools = CANONICAL_COMPANION_TOOL_IDS.map((id) => {
    const active = activeNames.has(id);
    let detail: string | undefined;

    if (!active) {
      if (LOCAL_ONLY_TOOL_IDS.has(id) && onVercel) {
        detail =
          "Filesystem and shell tools are disabled on Vercel serverless.";
      } else if (JIRA_TOOL_IDS.has(id) && !jiraOk) {
        detail = "Jira is not configured (env and credentials).";
      } else if (!active) {
        detail = "Not enabled for this deployment.";
      }
    }

    return {
      id,
      label: toolLabel(id),
      available: active,
      ...(detail ? { detail } : {}),
    };
  });

  return {
    generatedAt,
    environment,
    localInference,
    hostedInference,
    agentTools,
    agentTaskOrchestration: getAgentTaskOrchestrationHints(),
  };
}

/**
 * User-safe snapshot of what this deployment supports: models routing context,
 * agent tools, major inference modes, and delegation reachability + skill ids.
 * No secrets or raw env values.
 *
 * @param options.bypassDelegationCache — When true, re-probe delegation gateways
 *   instead of using the short TTL cache (operator refresh only).
 */
export async function buildDeploymentCapabilities(options?: {
  bypassDelegationCache?: boolean;
}): Promise<DeploymentCapabilities> {
  const base = buildDeploymentCapabilitiesSync();
  const delegation = await getDelegationDeploymentSnapshot({
    bypassCache: options?.bypassDelegationCache === true,
  });
  return {
    ...base,
    delegation,
  };
}
