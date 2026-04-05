import { z } from "zod";

/**
 * Delegation lanes: route work to the right executor instead of one overloaded turn.
 * ADR: docs/DECISIONS.md (Ghost of Virgil).
 */
export const VIRGIL_LANE_IDS = ["chat", "home", "code", "research"] as const;

export type VirgilLaneId = (typeof VIRGIL_LANE_IDS)[number];

export const virgilLaneIdSchema = z.enum(VIRGIL_LANE_IDS);

/**
 * System-prompt block for gateway tool-capable chat (injected in companion prompt).
 */
export function buildVirgilLaneGuidanceBlock(): string {
  return `Delegation lanes (pick one mental model per task; avoid mixing unrelated domains in one tool chain when avoidable):
- **chat** — Answer, plan, and use in-process tools (memory, calendar, documents, weather, goals) yourself.
- **home** — Execution on the user's LAN or messaging/files/shell outside this app: prefer **delegateTask** (OpenClaw) when OPENCLAW is configured; pair with calendar reads in-process if needed.
- **code** — Improvements to Virgil itself or the repo: use **submitAgentTask** after the user agrees; one focused task per submission.
- **research** — Web or fetch-backed synthesis: use **fetchUrl** when the hostname is allowlisted; summarize with sources; do not guess URLs.

When unsure, stay in **chat** unless the user clearly needs home execution or a repo task.`;
}
