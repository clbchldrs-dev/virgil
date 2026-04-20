import { z } from "zod";
import { delegationBackendShortPhrase } from "@/lib/integrations/delegation-labels";
import type { DelegationBackend } from "@/lib/integrations/delegation-provider";

/**
 * Delegation lanes: route work to the right executor instead of one overloaded turn.
 * ADR: docs/DECISIONS.md (Ghost of Virgil).
 */
export const VIRGIL_LANE_IDS = ["chat", "home", "code", "research"] as const;

export type VirgilLaneId = (typeof VIRGIL_LANE_IDS)[number];

export const virgilLaneIdSchema = z.enum(VIRGIL_LANE_IDS);

export type VirgilLaneDelegationHint = {
  enabled: boolean;
  backend: DelegationBackend;
  /** When true, **embedViaDelegation** is registered (LAN embedding for wiki / hybrid search). */
  embedToolEnabled?: boolean;
  /** Bridge env present but chat tools suppressed (`VIRGIL_DELEGATION_TOOLS_DISABLED`). */
  toolsPaused?: boolean;
};

/**
 * System-prompt block for gateway tool-capable chat (injected in companion prompt).
 */
export function buildVirgilLaneGuidanceBlock(
  delegation?: VirgilLaneDelegationHint
): string {
  const homeLine =
    delegation?.toolsPaused === true
      ? "- **home** — Delegation tools are **paused** by the operator (`VIRGIL_DELEGATION_TOOLS_DISABLED`). **delegateTask** is not in your tool list — say that plainly if the user asks for LAN execution; do not claim the bridge is broken."
      : delegation?.enabled === true
        ? `- **home** — Execution on the user's LAN or messaging/files/shell outside this app: prefer **delegateTask** (${delegationBackendShortPhrase(delegation.backend)}) when that tool is in your list; pair with calendar reads in-process if needed.`
        : "- **home** — Execution outside this app: use **delegateTask** only when it appears in your tool list (operator configures OpenClaw or Hermes). If it is missing, give concrete steps the user can run themselves; do not pretend a bridge exists.";

  return `Delegation lanes (pick one mental model per task; avoid mixing unrelated domains in one tool chain when avoidable):
- **chat** — Answer, plan, and use in-process tools (memory, calendar, documents, weather, goals) yourself.
${homeLine}
- **code** — Improvements to Virgil itself or the repo: use **submitAgentTask** after the user agrees; one focused task per submission.
- **research** — Web or fetch-backed synthesis: use **fetchUrl** when the hostname is allowlisted; summarize with sources; do not guess URLs.

When unsure, stay in **chat** unless the user clearly needs home execution or a repo task.`;
}
