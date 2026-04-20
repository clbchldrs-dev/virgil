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
    skillsFetchedAt: "",
    skillsStatus: "unavailable",
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
    skillsFetchedAt: "2026-04-19T00:00:00.000Z",
    skillsStatus: "ok",
    embedToolEnabled: true,
  });
  assert.match(appendix, /no per-message backend switch/i);
  assert.match(appendix, /generic-task/);
});
