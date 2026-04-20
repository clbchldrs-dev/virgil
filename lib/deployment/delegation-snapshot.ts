import { isDelegationEmbedToolEnabled } from "@/lib/integrations/delegation-embeddings";
import { isDelegationPollPrimaryActive } from "@/lib/integrations/delegation-poll-config";
import { isDelegationToolsPaused } from "@/lib/integrations/delegation-tools-policy";
import { evaluateDelegationPreflight } from "@/lib/integrations/delegation-preflight";
import {
  delegationContractDiagnostics,
  delegationListSkillDescriptorsUnion,
  delegationPing,
  getDelegationProvider,
  isDelegationConfigured,
  isDelegationFailoverEnabled,
} from "@/lib/integrations/delegation-provider";
import { evaluateDelegationReadiness } from "@/lib/integrations/delegation-readiness";
import type { DelegationRoutingTrace } from "@/lib/integrations/delegation-routing";
import { resolveDelegationSkill } from "@/lib/integrations/delegation-routing";
import { isHermesConfigured } from "@/lib/integrations/hermes-config";
import { isOpenClawConfigured } from "@/lib/integrations/openclaw-config";
import type {
  DelegationDiagnosticsCode,
  DelegationSkillContractStatus,
  DelegationSkillContractVersion,
  DelegationSkillDescriptor,
} from "@/lib/integrations/openclaw-types";

const TTL_MS = 55_000;
const MAX_SKILL_IDS_IN_APPENDIX = 24;

export type DelegationSkillsStatus = "ok" | "cached" | "unavailable";

export type DelegationDeploymentSnapshot = {
  configured: boolean;
  /** Chat tools suppressed by `VIRGIL_DELEGATION_TOOLS_DISABLED` — bridge may still be probed. */
  toolsPaused: boolean;
  primaryBackend: "hermes" | "openclaw";
  explicitBackendEnv: boolean;
  failoverEnabled: boolean;
  hermesEnvPresent: boolean;
  openclawEnvPresent: boolean;
  pollPrimaryActive: boolean;
  reachable: boolean | null;
  skills: string[];
  skillDescriptors: DelegationSkillDescriptor[];
  skillsFetchedAt: string;
  skillsStatus: DelegationSkillsStatus;
  skillsContractVersion: DelegationSkillContractVersion;
  skillsContractStatus: DelegationSkillContractStatus;
  diagnostics: {
    reachabilityCode: DelegationDiagnosticsCode;
    skillsCode: DelegationDiagnosticsCode;
    primaryReachable: boolean;
    secondaryReachable: boolean | null;
    skillsCount: number;
  };
  delegationProbe: {
    description: string;
    readiness: ReturnType<typeof evaluateDelegationReadiness>;
    routing: DelegationRoutingTrace;
    preflight: ReturnType<typeof evaluateDelegationPreflight>;
  } | null;
  /** When true, chat registers **embedViaDelegation** alongside **delegateTask**. */
  embedToolEnabled: boolean;
};

type CacheEntry = {
  at: number;
  snapshot: DelegationDeploymentSnapshot;
};

let cache: CacheEntry | null = null;

function emptySnapshot(
  partial: Partial<DelegationDeploymentSnapshot> & {
    primaryBackend: "hermes" | "openclaw";
  }
): DelegationDeploymentSnapshot {
  const now = new Date().toISOString();
  return {
    configured: false,
    toolsPaused: isDelegationToolsPaused(),
    explicitBackendEnv: Boolean(process.env.VIRGIL_DELEGATION_BACKEND?.trim()),
    failoverEnabled: isDelegationFailoverEnabled(),
    hermesEnvPresent: isHermesConfigured(),
    openclawEnvPresent: isOpenClawConfigured(),
    pollPrimaryActive: isDelegationPollPrimaryActive(),
    reachable: null,
    skills: [],
    skillDescriptors: [],
    skillsFetchedAt: now,
    skillsStatus: "unavailable",
    skillsContractVersion: "v0-name-only",
    skillsContractStatus: "name_only",
    diagnostics: {
      reachabilityCode: "not_configured",
      skillsCode: "skills_unavailable",
      primaryReachable: false,
      secondaryReachable: null,
      skillsCount: 0,
    },
    delegationProbe: null,
    embedToolEnabled: false,
    ...partial,
  };
}

async function buildFreshSnapshot(): Promise<DelegationDeploymentSnapshot> {
  const primaryBackend = getDelegationProvider().backend;
  const explicitBackendEnv = Boolean(
    process.env.VIRGIL_DELEGATION_BACKEND?.trim()
  );
  const failoverEnabled = isDelegationFailoverEnabled();
  const hermesEnvPresent = isHermesConfigured();
  const openclawEnvPresent = isOpenClawConfigured();
  const pollPrimaryActive = isDelegationPollPrimaryActive();

  if (!isDelegationConfigured()) {
    return emptySnapshot({
      configured: false,
      toolsPaused: isDelegationToolsPaused(),
      primaryBackend,
      explicitBackendEnv,
      failoverEnabled,
      hermesEnvPresent,
      openclawEnvPresent,
      pollPrimaryActive,
    });
  }

  const toolsPaused = isDelegationToolsPaused();

  let reachable: boolean | null = null;
  try {
    reachable = await delegationPing();
  } catch {
    reachable = false;
  }

  const now = new Date().toISOString();
  const diagnostics = await delegationContractDiagnostics();
  let skills: string[] = [];
  let skillDescriptors: DelegationSkillDescriptor[] = [];
  let skillsStatus: DelegationSkillsStatus = "unavailable";
  let skillsFetchedAt = now;
  const probeDescription =
    "List currently available skills and explain routing.";

  try {
    skillDescriptors = await delegationListSkillDescriptorsUnion();
    skills = skillDescriptors.map((skill) => skill.id);
    skillsStatus = "ok";
  } catch {
    if (cache !== null && cache.snapshot.skills.length > 0) {
      skills = cache.snapshot.skills;
      skillDescriptors = cache.snapshot.skillDescriptors;
      skillsFetchedAt = cache.snapshot.skillsFetchedAt;
      skillsStatus = "cached";
    }
  }

  const routing = resolveDelegationSkill({
    description: probeDescription,
    lane: "research",
    advertisedSkills: skills,
  });
  const readiness = evaluateDelegationReadiness({
    online: reachable === true,
    resolvedSkill: routing.resolvedSkill,
    skillDescriptors,
  });
  const preflight = evaluateDelegationPreflight({
    readiness,
    advertisedSkillCount: skillDescriptors.length,
  });

  return {
    configured: true,
    toolsPaused,
    primaryBackend,
    explicitBackendEnv,
    failoverEnabled,
    hermesEnvPresent,
    openclawEnvPresent,
    pollPrimaryActive,
    reachable,
    skills,
    skillDescriptors,
    skillsFetchedAt,
    skillsStatus,
    skillsContractVersion: "v0-name-only",
    skillsContractStatus: "name_only",
    diagnostics: {
      reachabilityCode: diagnostics.reachabilityCode,
      skillsCode: diagnostics.skillsCode,
      primaryReachable: diagnostics.primaryReachable,
      secondaryReachable: diagnostics.secondaryReachable,
      skillsCount: diagnostics.skillsCount,
    },
    delegationProbe: {
      description: probeDescription,
      readiness,
      routing: routing.trace,
      preflight,
    },
    embedToolEnabled: isDelegationEmbedToolEnabled(),
  };
}

/**
 * Cached snapshot of delegation reachability and skill ids for deployment UI and prompts.
 * Uses a short TTL to avoid hammering LAN gateways on every request.
 *
 * @param options.bypassCache — When true, always re-fetch from gateways (used by
 *   `GET /api/deployment/capabilities?refresh=1` for signed-in operators).
 */
export async function getDelegationDeploymentSnapshot(options?: {
  bypassCache?: boolean;
}): Promise<DelegationDeploymentSnapshot> {
  if (
    !options?.bypassCache &&
    cache !== null &&
    Date.now() - cache.at < TTL_MS
  ) {
    return cache.snapshot;
  }
  const snapshot = await buildFreshSnapshot();
  cache = { at: Date.now(), snapshot };
  return snapshot;
}

/** Short paragraph for system prompt when delegation tools are registered. */
export function buildDelegationCapabilityAppendix(
  snapshot: DelegationDeploymentSnapshot
): string {
  if (!snapshot.configured) {
    return "";
  }
  if (snapshot.toolsPaused) {
    return (
      "Delegation tools are **paused** in chat (`VIRGIL_DELEGATION_TOOLS_DISABLED`). " +
      "Do not call **delegateTask**, **approveDelegationIntent**, or **embedViaDelegation** — they are not in your tool list. " +
      "The operator can still inspect bridge status on the Deployment page."
    );
  }
  const backendName =
    snapshot.primaryBackend === "hermes" ? "Hermes" : "OpenClaw";
  const reach =
    snapshot.reachable === null
      ? "Reachability was not checked."
      : snapshot.reachable
        ? "Delegation gateway responded to a health check."
        : "Delegation gateway did not respond — tasks may queue until it is back.";
  const failover = snapshot.failoverEnabled
    ? "Failover between Hermes and OpenClaw is enabled when both are configured."
    : "Failover is off; only the primary backend is used.";
  const routing =
    "Routing: intents go to the primary backend when it is up; otherwise the secondary may be used when failover is on. There is no per-message backend switch in Virgil.";

  if (snapshot.skillsStatus === "unavailable" && snapshot.skills.length === 0) {
    return `Delegation (${backendName}): ${reach} ${failover} ${routing} Skill list unavailable — use the deployment page or omit the skill field so one can be inferred. Contract: ${snapshot.skillsContractVersion} (${snapshot.skillsContractStatus}). Diagnostics: reachability=${snapshot.diagnostics.reachabilityCode}, skills=${snapshot.diagnostics.skillsCode}.`;
  }

  const sample = snapshot.skills.slice(0, MAX_SKILL_IDS_IN_APPENDIX);
  const extra =
    snapshot.skills.length > sample.length
      ? ` (+${snapshot.skills.length - sample.length} more)`
      : "";
  const freshness =
    snapshot.skillsStatus === "ok"
      ? `(skills snapshot ${snapshot.skillsFetchedAt})`
      : snapshot.skillsStatus === "cached"
        ? `(skills may be stale; last fetch ${snapshot.skillsFetchedAt})`
        : "";

  return `Delegation (${backendName}): ${reach} ${failover} ${routing} Known skill ids (from gateway; not exhaustive if list failed): ${sample.join(", ")}${extra}. ${freshness} Contract: ${snapshot.skillsContractVersion} (${snapshot.skillsContractStatus}). Diagnostics: reachability=${snapshot.diagnostics.reachabilityCode}, skills=${snapshot.diagnostics.skillsCode}.`;
}
