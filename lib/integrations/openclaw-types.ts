export type ClawIntentPriority = "low" | "normal" | "high";

export type DelegationSkillContractVersion = "v0-name-only";
export type DelegationSkillContractStatus = "name_only";
export type DelegationSkillRiskLevel = "low" | "medium" | "high" | "unknown";
export type DelegationDiagnosticsCode =
  | "ok"
  | "not_configured"
  | "primary_unreachable"
  | "secondary_unreachable"
  | "both_unreachable"
  | "skills_unavailable"
  | "skills_empty";

/**
 * Backward-compatible machine-readable descriptor for delegation skill ids.
 * Current bridges only guarantee ids, so schema/details are null until upstream
 * gateways expose richer contracts.
 */
export type DelegationSkillDescriptor = {
  id: string;
  name: string;
  contractVersion: DelegationSkillContractVersion;
  contractStatus: DelegationSkillContractStatus;
  description: string | null;
  inputSchema: Record<string, unknown> | null;
  riskLevel: DelegationSkillRiskLevel;
  requiresConfirmation: boolean | null;
  examples: string[];
  sourceBackends: Array<"openclaw" | "hermes">;
  discoveredAt: string;
};

export type ClawIntent = {
  skill: string;
  params: Record<string, unknown>;
  priority: ClawIntentPriority;
  source: string;
  requiresConfirmation: boolean;
};

export type ClawResult = {
  success: boolean;
  output?: string;
  error?: string;
  errorCode?: DelegationDiagnosticsCode;
  skill: string;
  executedAt: string;
  /** When set, the intent ran on the complementary gateway (Hermes ↔ OpenClaw failover). */
  routedVia?: "openclaw" | "hermes";
  /** True when Virgil queued to Postgres for a local poll worker (no synchronous HTTP). */
  deferredToPollWorker?: boolean;
};

export type VirgilBridgeEvent = {
  type: string;
  payload: Record<string, unknown>;
};
