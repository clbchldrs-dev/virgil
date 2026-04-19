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
import type { ClawIntent, ClawResult } from "@/lib/integrations/openclaw-types";

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

export function isDelegationConfigured(): boolean {
  return (
    getDelegationProvider().isConfigured() || isDelegationPollPrimaryActive()
  );
}
