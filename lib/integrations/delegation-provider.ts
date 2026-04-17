import { pingHermes, sendHermesIntent } from "@/lib/integrations/hermes-client";
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
  sendIntent: (intent: ClawIntent) => Promise<ClawResult>;
};

function getRequestedDelegationBackend(): DelegationBackend {
  return process.env.VIRGIL_DELEGATION_BACKEND === "hermes"
    ? "hermes"
    : "openclaw";
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
  listSkillNames: async () => [],
  sendIntent: sendHermesIntent,
};

export function getDelegationProvider(): DelegationProvider {
  const backend = getRequestedDelegationBackend();
  if (backend === "hermes") {
    return hermesProvider;
  }
  return openClawProvider;
}

export function isDelegationConfigured(): boolean {
  return getDelegationProvider().isConfigured();
}
