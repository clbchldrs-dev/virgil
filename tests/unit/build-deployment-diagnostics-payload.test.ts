import assert from "node:assert/strict";
import test from "node:test";
import {
  buildDeploymentCapabilitiesDiagnosticsSlice,
  buildDeploymentDiagnosticsPayload,
  DEPLOYMENT_DIAGNOSTICS_SCHEMA_VERSION,
} from "@/lib/deployment/build-deployment-diagnostics-payload";
import type { DeploymentCapabilities } from "@/lib/deployment/capabilities";

const minimalCapabilities = (): DeploymentCapabilities => ({
  generatedAt: "2026-04-20T12:00:00.000Z",
  environment: "local",
  localInference: { available: true, detail: "ollama" },
  hostedInference: { available: true, detail: "gateway" },
  agentTools: [
    { id: "getBriefing", label: "Briefing", available: true },
    {
      id: "executeShell",
      label: "Shell",
      available: false,
      detail: "local only",
    },
  ],
  agentTaskOrchestration: {
    triageEnabled: false,
    multiAgentPlannerEnabled: false,
    plannerStageCount: null,
  },
  delegation: null,
  delegationPollQueue: null,
});

test("diagnostics slice omits undefined detail", () => {
  const slice = buildDeploymentCapabilitiesDiagnosticsSlice(
    minimalCapabilities()
  );
  assert.equal(slice.agentTools[0]?.detail, undefined);
  assert.equal(slice.agentTools[1]?.detail, "local only");
});

test("diagnostics payload includes schema, capabilities slice, and health", () => {
  const payload = buildDeploymentDiagnosticsPayload({
    capabilities: minimalCapabilities(),
    delegationHealth: { configured: false, delegationOnline: false },
  });
  assert.equal(payload.schemaVersion, DEPLOYMENT_DIAGNOSTICS_SCHEMA_VERSION);
  assert.equal(typeof payload.exportedAt, "string");
  const caps = payload.capabilities as { environment: string };
  assert.equal(caps.environment, "local");
  assert.equal(payload.delegationSnapshot, null);
  assert.deepEqual(payload.delegationHealth, {
    configured: false,
    delegationOnline: false,
  });
});
