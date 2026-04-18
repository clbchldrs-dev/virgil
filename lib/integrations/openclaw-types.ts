export type ClawIntentPriority = "low" | "normal" | "high";

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
  skill: string;
  executedAt: string;
  /** When set, the intent ran on the complementary gateway (Hermes ↔ OpenClaw failover). */
  routedVia?: "openclaw" | "hermes";
};

export type VirgilBridgeEvent = {
  type: string;
  payload: Record<string, unknown>;
};
