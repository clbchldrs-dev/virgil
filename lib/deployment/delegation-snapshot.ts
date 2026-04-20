import { isDelegationEmbedToolEnabled } from "@/lib/integrations/delegation-embeddings";
import { isDelegationPollPrimaryActive } from "@/lib/integrations/delegation-poll-config";
import {
  delegationListSkillNamesUnion,
  delegationPing,
  getDelegationProvider,
  isDelegationConfigured,
  isDelegationFailoverEnabled,
} from "@/lib/integrations/delegation-provider";
import { isHermesConfigured } from "@/lib/integrations/hermes-config";
import { isOpenClawConfigured } from "@/lib/integrations/openclaw-config";

const TTL_MS = 55_000;
const MAX_SKILL_IDS_IN_APPENDIX = 24;

export type DelegationSkillsStatus = "ok" | "cached" | "unavailable";

export type DelegationDeploymentSnapshot = {
  configured: boolean;
  primaryBackend: "hermes" | "openclaw";
  explicitBackendEnv: boolean;
  failoverEnabled: boolean;
  hermesEnvPresent: boolean;
  openclawEnvPresent: boolean;
  pollPrimaryActive: boolean;
  reachable: boolean | null;
  skills: string[];
  skillsFetchedAt: string;
  skillsStatus: DelegationSkillsStatus;
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
    explicitBackendEnv: Boolean(process.env.VIRGIL_DELEGATION_BACKEND?.trim()),
    failoverEnabled: isDelegationFailoverEnabled(),
    hermesEnvPresent: isHermesConfigured(),
    openclawEnvPresent: isOpenClawConfigured(),
    pollPrimaryActive: isDelegationPollPrimaryActive(),
    reachable: null,
    skills: [],
    skillsFetchedAt: now,
    skillsStatus: "unavailable",
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
      primaryBackend,
      explicitBackendEnv,
      failoverEnabled,
      hermesEnvPresent,
      openclawEnvPresent,
      pollPrimaryActive,
    });
  }

  let reachable: boolean | null = null;
  try {
    reachable = await delegationPing();
  } catch {
    reachable = false;
  }

  const now = new Date().toISOString();
  let skills: string[] = [];
  let skillsStatus: DelegationSkillsStatus = "unavailable";
  let skillsFetchedAt = now;

  try {
    skills = await delegationListSkillNamesUnion();
    skillsStatus = "ok";
  } catch {
    if (cache !== null && cache.snapshot.skills.length > 0) {
      skills = cache.snapshot.skills;
      skillsFetchedAt = cache.snapshot.skillsFetchedAt;
      skillsStatus = "cached";
    }
  }

  return {
    configured: true,
    primaryBackend,
    explicitBackendEnv,
    failoverEnabled,
    hermesEnvPresent,
    openclawEnvPresent,
    pollPrimaryActive,
    reachable,
    skills,
    skillsFetchedAt,
    skillsStatus,
    embedToolEnabled: isDelegationEmbedToolEnabled(),
  };
}

/**
 * Cached snapshot of delegation reachability and skill ids for deployment UI and prompts.
 * Uses a short TTL to avoid hammering LAN gateways on every request.
 */
export async function getDelegationDeploymentSnapshot(): Promise<DelegationDeploymentSnapshot> {
  if (cache !== null && Date.now() - cache.at < TTL_MS) {
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
    return `Delegation (${backendName}): ${reach} ${failover} ${routing} Skill list unavailable — use the deployment page or omit the skill field so one can be inferred.`;
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

  return `Delegation (${backendName}): ${reach} ${failover} ${routing} Known skill ids (from gateway; not exhaustive if list failed): ${sample.join(", ")}${extra}. ${freshness}`;
}
