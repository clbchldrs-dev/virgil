import type { DeploymentCapabilities } from "@/lib/deployment/capabilities";
import type { DelegationDeploymentSnapshot } from "@/lib/deployment/delegation-snapshot";
import { sanitizeOperatorExportDeep } from "@/lib/deployment/sanitize-operator-export";

/**
 * Operator-visible JSON sources (see security plan Unit 1):
 *
 * | Surface | Route / entry | Serializer |
 * |---------|----------------|------------|
 * | Deployment capabilities (browser) | `GET /api/deployment/capabilities` | `buildDeploymentCapabilities` (`lib/deployment/capabilities.ts`) |
 * | Clipboard “Copy diagnostics JSON” | Client merges capabilities + `GET /api/delegation/health` | `buildDeploymentDiagnosticsPayload` (this file) |
 * | Delegation health alone | `GET /api/delegation/health` | `app/(chat)/api/delegation/health/route.ts` |
 * | Poll worker (not for clipboard) | `GET/POST /api/delegation/worker/*` | DB rows / `{ ok: true }` JSON |
 */

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
    ...(data.pendingIntentStatusCounts == null
      ? {}
      : { pendingIntentStatusCounts: data.pendingIntentStatusCounts }),
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
  const payload: DeploymentDiagnosticsPayload = {
    schemaVersion: DEPLOYMENT_DIAGNOSTICS_SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    note: "User-safe snapshot only; no secrets or raw env values.",
    capabilities: buildDeploymentCapabilitiesDiagnosticsSlice(
      args.capabilities
    ),
    delegationSnapshot: args.capabilities.delegation ?? null,
    delegationHealth: args.delegationHealth,
  };
  return sanitizeOperatorExportDeep(payload) as DeploymentDiagnosticsPayload;
}
