import { isDelegationConfigured } from "@/lib/integrations/delegation-provider";

/**
 * When set to `1` / `true` / `yes`, chat does not register **delegateTask** /
 * **approveDelegationIntent** / **embedViaDelegation** — even if Hermes/OpenClaw
 * URLs are configured. The deployment snapshot still probes the bridge for
 * operators; the poll worker may continue draining rows already queued.
 */
export function isDelegationToolsPaused(): boolean {
  const raw =
    process.env.VIRGIL_DELEGATION_TOOLS_DISABLED?.trim().toLowerCase();
  return raw === "1" || raw === "true" || raw === "yes";
}

/** True when delegation tools should appear in the chat tool list. */
export function isDelegationChatToolsEnabled(): boolean {
  return isDelegationConfigured() && !isDelegationToolsPaused();
}
