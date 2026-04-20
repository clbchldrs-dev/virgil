import type { DeploymentCapabilities } from "@/lib/deployment/capabilities";
import type { DelegationDeploymentSnapshot } from "@/lib/deployment/delegation-snapshot";

export const DEPLOYMENT_DIAGNOSTICS_SCHEMA_VERSION =
  "virgil-deployment-diagnostics-v1";

export function buildDeploymentCapabilitiesDiagnosticsSlice(
  data: DeploymentCapabilities
) {
  return {
    generatedAt: data.generatedAt,
    environment: data.environment,
    hostedInference: data.hostedInference,
    localInference: data.localInference,
    agentTaskOrchestration: data.agentTaskOrchestration,
    agentTools: data.agentTools.map((t) => ({
      id: t.id,
      available: t.available,
      ...(t.detail ? { detail: t.detail } : {}),
    })),
  };
}

export type DeploymentCapabilitiesDiagnosticsSlice = ReturnType<
  typeof buildDeploymentCapabilitiesDiagnosticsSlice
>;

export type DeploymentDiagnosticsPayload = {
  schemaVersion: string;
  exportedAt: string;
  note: string;
  capabilities: DeploymentCapabilitiesDiagnosticsSlice;
  delegationSnapshot: DelegationDeploymentSnapshot | null;
  delegationHealth: unknown;
};

/**
 * User-safe JSON for operators (issues, Slack, support). No secrets or raw env values.
 */
export function buildDeploymentDiagnosticsPayload(args: {
  capabilities: DeploymentCapabilities;
  delegationHealth: unknown;
}): DeploymentDiagnosticsPayload {
  return {
    schemaVersion: DEPLOYMENT_DIAGNOSTICS_SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    note: "User-safe snapshot only; no secrets or raw env values.",
    capabilities: buildDeploymentCapabilitiesDiagnosticsSlice(
      args.capabilities
    ),
    delegationSnapshot: args.capabilities.delegation ?? null,
    delegationHealth: args.delegationHealth,
  };
}
