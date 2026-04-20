import assert from "node:assert/strict";
import test from "node:test";

import type { DelegationDeploymentSnapshot } from "../../lib/deployment/delegation-snapshot";

test("buildDelegationCapabilityAppendix returns empty when delegation not configured", async () => {
  const { buildDelegationCapabilityAppendix } = await import(
    "../../lib/deployment/delegation-snapshot"
  );
  const snap: DelegationDeploymentSnapshot = {
    configured: false,
    primaryBackend: "hermes",
    explicitBackendEnv: false,
    failoverEnabled: false,
    hermesEnvPresent: false,
    openclawEnvPresent: false,
    pollPrimaryActive: false,
    reachable: null,
    skills: [],
    skillDescriptors: [],
    skillsFetchedAt: "",
    skillsStatus: "unavailable",
    skillsContractVersion: "v0-name-only",
    skillsContractStatus: "name_only",
    diagnostics: {
      reachabilityCode: "not_configured",
      skillsCode: "skills_unavailable",
      primaryReachable: false,
      secondaryReachable: null,
      skillsCount: 0,
    },
    delegationProbe: null,
    embedToolEnabled: false,
  };
  assert.equal(buildDelegationCapabilityAppendix(snap), "");
});

test("buildDelegationCapabilityAppendix mentions routing when configured", async () => {
  const { buildDelegationCapabilityAppendix } = await import(
    "../../lib/deployment/delegation-snapshot"
  );
  const appendix = buildDelegationCapabilityAppendix({
    configured: true,
    primaryBackend: "openclaw",
    explicitBackendEnv: true,
    failoverEnabled: false,
    hermesEnvPresent: false,
    openclawEnvPresent: true,
    pollPrimaryActive: false,
    reachable: true,
    skills: ["generic-task"],
    skillDescriptors: [
      {
        id: "generic-task",
        name: "generic-task",
        contractVersion: "v0-name-only",
        contractStatus: "name_only",
        description: null,
        inputSchema: null,
        riskLevel: "unknown",
        requiresConfirmation: null,
        examples: [],
        sourceBackends: ["openclaw"],
        discoveredAt: "2026-04-19T00:00:00.000Z",
      },
    ],
    skillsFetchedAt: "2026-04-19T00:00:00.000Z",
    skillsStatus: "ok",
    skillsContractVersion: "v0-name-only",
    skillsContractStatus: "name_only",
    diagnostics: {
      reachabilityCode: "ok",
      skillsCode: "ok",
      primaryReachable: true,
      secondaryReachable: null,
      skillsCount: 1,
    },
    delegationProbe: {
      description: "List currently available skills and explain routing.",
      routing: {
        policyVersion: "v1",
        providedSkill: null,
        lane: "research",
        taskType: null,
        strategy: "fallback_generic",
        candidates: ["generic-task"],
        matchedSkillFromDescription: null,
        resolvedSkill: "generic-task",
      },
      readiness: {
        score: 0.8,
        recommendation: "delegate",
        reasons: [
          "Delegation backend is online",
          "Resolved skill is advertised",
        ],
        online: true,
        resolvedSkill: "generic-task",
        resolvedSkillAdvertised: true,
        providedSkill: null,
      },
      preflight: {
        ok: true,
        reason: "ok",
        message: null,
      },
    },
    embedToolEnabled: true,
  });
  assert.match(appendix, /no per-message backend switch/i);
  assert.match(appendix, /generic-task/);
});
