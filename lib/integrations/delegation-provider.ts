import { isDelegationPollPrimaryActive } from "@/lib/integrations/delegation-poll-config";
import {
  listHermesSkillNames,
  pingHermes,
  sendHermesIntent,
} from "@/lib/integrations/hermes-client";
import { isHermesConfigured } from "@/lib/integrations/hermes-config";
import {
  getCachedOpenClawSkillNames,
  pingOpenClaw,
  sendOpenClawIntent,
} from "@/lib/integrations/openclaw-client";
import { isOpenClawConfigured } from "@/lib/integrations/openclaw-config";
import type {
  ClawIntent,
  ClawResult,
  DelegationDiagnosticsCode,
  DelegationSkillDescriptor,
  DelegationSkillRiskLevel,
} from "@/lib/integrations/openclaw-types";

export type DelegationBackend = "openclaw" | "hermes";

export type DelegationProvider = {
  backend: DelegationBackend;
  isConfigured: () => boolean;
  ping: () => Promise<boolean>;
  listSkillNames: () => Promise<string[]>;
  sendIntent: (
    intent: ClawIntent,
    options?: { timeoutMs?: number }
  ) => Promise<ClawResult>;
};

export type DelegationContractDiagnostics = {
  primaryBackend: DelegationBackend;
  failoverEnabled: boolean;
  primaryConfigured: boolean;
  secondaryConfigured: boolean;
  primaryReachable: boolean;
  secondaryReachable: boolean | null;
  reachabilityCode: DelegationDiagnosticsCode;
  skillsCode: DelegationDiagnosticsCode;
  skillsCount: number;
};

const SKILL_CONTRACT_VERSION = "v0-name-only" as const;

function inferSkillRiskLevel(skillId: string): DelegationSkillRiskLevel {
  const lowered = skillId.toLowerCase();
  if (
    lowered.includes("delete") ||
    lowered.includes("write") ||
    lowered.includes("shell") ||
    lowered.includes("exec") ||
    lowered.includes("spawn") ||
    lowered.includes("send-")
  ) {
    return "high";
  }
  if (
    lowered.includes("update") ||
    lowered.includes("approve") ||
    lowered.includes("delegate")
  ) {
    return "medium";
  }
  if (
    lowered.includes("read") ||
    lowered.includes("list") ||
    lowered.includes("status") ||
    lowered.includes("health")
  ) {
    return "low";
  }
  return "unknown";
}

function getRequestedDelegationBackend(): DelegationBackend {
  const explicit = process.env.VIRGIL_DELEGATION_BACKEND;
  if (explicit === "hermes" || explicit === "openclaw") {
    return explicit;
  }

  // Hermes-first default for Virgil 1.1+, with OpenClaw compatibility fallback.
  if (isHermesConfigured()) {
    return "hermes";
  }
  if (isOpenClawConfigured()) {
    return "openclaw";
  }
  return "hermes";
}

const openClawProvider: DelegationProvider = {
  backend: "openclaw",
  isConfigured: isOpenClawConfigured,
  ping: pingOpenClaw,
  listSkillNames: getCachedOpenClawSkillNames,
  sendIntent: sendOpenClawIntent,
};

const hermesProvider: DelegationProvider = {
  backend: "hermes",
  isConfigured: isHermesConfigured,
  ping: pingHermes,
  listSkillNames: listHermesSkillNames,
  sendIntent: sendHermesIntent,
};

export function getDelegationProvider(): DelegationProvider {
  const backend = getRequestedDelegationBackend();
  if (backend === "hermes") {
    return hermesProvider;
  }
  return openClawProvider;
}

/**
 * When both Hermes and OpenClaw are configured, allow routing to the complementary
 * gateway if the primary is unreachable (virgil-manos: Hermes first, OpenClaw second).
 * Set `VIRGIL_DELEGATION_FAILOVER=0` to disable. When unset, failover is **on** only if
 * both bridges have env URLs (same condition as dual-stack detection).
 */
export function isDelegationFailoverEnabled(): boolean {
  const raw = process.env.VIRGIL_DELEGATION_FAILOVER?.trim().toLowerCase();
  if (raw === "0" || raw === "false" || raw === "off") {
    return false;
  }
  if (raw === "1" || raw === "true" || raw === "on") {
    return true;
  }
  return isHermesConfigured() && isOpenClawConfigured();
}

function getSecondaryDelegationProvider(): DelegationProvider | null {
  const primary = getRequestedDelegationBackend();
  if (primary === "hermes") {
    return isOpenClawConfigured() ? openClawProvider : null;
  }
  return isHermesConfigured() ? hermesProvider : null;
}

/** True if the primary gateway responds, or (when failover on) the secondary does. */
export async function delegationPing(): Promise<boolean> {
  if (isDelegationPollPrimaryActive()) {
    return true;
  }
  const primary = getDelegationProvider();
  if (await primary.ping()) {
    return true;
  }
  const secondary = getSecondaryDelegationProvider();
  if (!secondary || !isDelegationFailoverEnabled()) {
    return false;
  }
  return secondary.ping();
}

export async function delegationContractDiagnostics(): Promise<DelegationContractDiagnostics> {
  const primary = getDelegationProvider();
  const secondary = getSecondaryDelegationProvider();
  const failoverEnabled = isDelegationFailoverEnabled();
  const primaryConfigured = primary.isConfigured();
  const secondaryConfigured = secondary?.isConfigured() ?? false;

  if (isDelegationPollPrimaryActive()) {
    return {
      primaryBackend: primary.backend,
      failoverEnabled,
      primaryConfigured,
      secondaryConfigured,
      primaryReachable: true,
      secondaryReachable: secondary ? null : null,
      reachabilityCode: "ok",
      skillsCode: "skills_unavailable",
      skillsCount: 0,
    };
  }

  const primaryReachable = primaryConfigured ? await primary.ping() : false;
  const secondaryReachable =
    failoverEnabled && secondary && secondaryConfigured
      ? await secondary.ping()
      : null;

  let reachabilityCode: DelegationDiagnosticsCode = "ok";
  if (!primaryConfigured && !secondaryConfigured) {
    reachabilityCode = "not_configured";
  } else if (!primaryReachable) {
    if (!secondary || !failoverEnabled || secondaryReachable === null) {
      reachabilityCode = "primary_unreachable";
    } else if (!secondaryReachable) {
      reachabilityCode = "both_unreachable";
    }
  }

  let skillsCount = 0;
  let skillsCode: DelegationDiagnosticsCode = "ok";
  try {
    const skills = await delegationListSkillNamesUnion();
    skillsCount = skills.length;
    skillsCode = skills.length > 0 ? "ok" : "skills_empty";
  } catch {
    skillsCode = "skills_unavailable";
  }

  return {
    primaryBackend: primary.backend,
    failoverEnabled,
    primaryConfigured,
    secondaryConfigured,
    primaryReachable,
    secondaryReachable,
    reachabilityCode,
    skillsCode,
    skillsCount,
  };
}

/** Sends to primary when up; otherwise to secondary when failover is enabled and secondary is up. */
export async function delegationSendIntent(
  intent: ClawIntent,
  options?: { timeoutMs?: number }
): Promise<ClawResult> {
  const primary = getDelegationProvider();
  const secondary = getSecondaryDelegationProvider();
  const failover = isDelegationFailoverEnabled();

  if (await primary.ping()) {
    return primary.sendIntent(intent, options);
  }

  if (failover && secondary && (await secondary.ping())) {
    const result = await secondary.sendIntent(intent, options);
    return { ...result, routedVia: secondary.backend };
  }

  return primary.sendIntent(intent, options);
}

/**
 * Skill ids advertised by the primary gateway, merged with the secondary when
 * Hermes+OpenClaw failover can route either way (embed + delegate validation).
 */
export async function delegationListSkillNamesUnion(): Promise<string[]> {
  const primary = getDelegationProvider();
  const primarySkills = await primary.listSkillNames();
  const secondary = getSecondaryDelegationProvider();
  if (!secondary || !isDelegationFailoverEnabled()) {
    return primarySkills;
  }
  const secondarySkills = await secondary.listSkillNames();
  return [...new Set([...primarySkills, ...secondarySkills])];
}

/**
 * Contract-oriented skill descriptors derived from current backend id lists.
 * Until gateways expose typed schemas, this remains name-only (`v0-name-only`)
 * while still giving callers stable metadata and source attribution.
 */
export async function delegationListSkillDescriptorsUnion(): Promise<
  DelegationSkillDescriptor[]
> {
  const primary = getDelegationProvider();
  const primarySkills = await primary.listSkillNames();
  const secondary = getSecondaryDelegationProvider();
  const secondarySkills =
    secondary && isDelegationFailoverEnabled()
      ? await secondary.listSkillNames()
      : [];

  const sourceMap = new Map<string, Set<"openclaw" | "hermes">>();
  for (const id of primarySkills) {
    const set = sourceMap.get(id) ?? new Set<"openclaw" | "hermes">();
    set.add(primary.backend);
    sourceMap.set(id, set);
  }
  for (const id of secondarySkills) {
    const set = sourceMap.get(id) ?? new Set<"openclaw" | "hermes">();
    set.add(secondary?.backend ?? "openclaw");
    sourceMap.set(id, set);
  }

  const discoveredAt = new Date().toISOString();
  return [...sourceMap.entries()]
    .map(([id, sources]) => ({
      id,
      name: id,
      contractVersion: SKILL_CONTRACT_VERSION,
      contractStatus: "name_only" as const,
      description: null,
      inputSchema: null,
      riskLevel: inferSkillRiskLevel(id),
      requiresConfirmation: null,
      examples: [],
      sourceBackends: [...sources].sort(),
      discoveredAt,
    }))
    .sort((a, b) => a.id.localeCompare(b.id));
}

export function isDelegationConfigured(): boolean {
  return (
    getDelegationProvider().isConfigured() || isDelegationPollPrimaryActive()
  );
}
