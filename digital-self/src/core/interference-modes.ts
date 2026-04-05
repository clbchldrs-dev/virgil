import type { InterferenceMode } from "./schemas.js";

const DEFAULT_MODE: InterferenceMode = "assistant";

export function resolveInterferenceMode(
  requested: InterferenceMode | undefined,
  stored: InterferenceMode | undefined
): InterferenceMode {
  return requested ?? stored ?? DEFAULT_MODE;
}

export function describeMode(mode: InterferenceMode): string {
  switch (mode) {
    case "shield":
      return "Hold outbound replies; batch for summary and explicit approval.";
    case "assistant":
      return "Draft replies; require approval unless policy marks low-risk auto.";
    case "autopilot-lite":
      return "Auto-send when policy score is low; otherwise approval.";
    default: {
      const _exhaustive: never = mode;
      return _exhaustive;
    }
  }
}
