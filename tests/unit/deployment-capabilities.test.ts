import assert from "node:assert/strict";
import test from "node:test";

function withEnv(
  patch: Record<string, string | undefined>,
  fn: () => void | Promise<void>
) {
  const prev: Record<string, string | undefined> = {};
  for (const key of Object.keys(patch)) {
    prev[key] = process.env[key];
    const v = patch[key];
    if (v === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = v;
    }
  }
  return Promise.resolve(fn()).finally(() => {
    for (const key of Object.keys(patch)) {
      const p = prev[key];
      if (p === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = p;
      }
    }
  });
}

test("buildDeploymentCapabilities marks local inference unavailable on Vercel", async () => {
  await withEnv(
    {
      VERCEL: "1",
      AI_GATEWAY_API_KEY: "x",
      VERCEL_OIDC_TOKEN: undefined,
    },
    async () => {
      const { buildDeploymentCapabilitiesSync } = await import(
        "../../lib/deployment/capabilities"
      );
      const c = buildDeploymentCapabilitiesSync();
      assert.equal(c.environment, "vercel");
      assert.ok(c.agentTaskOrchestration);
      assert.equal(typeof c.agentTaskOrchestration.triageEnabled, "boolean");
      assert.equal(c.localInference.available, false);
      assert.match(c.localInference.detail, /Ollama|LAN|serverless/i);
      const shell = c.agentTools.find((t) => t.id === "executeShell");
      assert.ok(shell);
      assert.equal(shell?.available, false);
      assert.ok(shell?.detail);
    }
  );
});

test("buildDeploymentCapabilities reports hosted inference when gateway key set", async () => {
  await withEnv(
    {
      VERCEL: undefined,
      AI_GATEWAY_API_KEY: "sk-test",
      VERCEL_OIDC_TOKEN: undefined,
    },
    async () => {
      const { buildDeploymentCapabilitiesSync } = await import(
        "../../lib/deployment/capabilities"
      );
      const c = buildDeploymentCapabilitiesSync();
      assert.equal(c.environment, "local");
      assert.equal(c.hostedInference.available, true);
      assert.equal(c.localInference.available, true);
    }
  );
});

test("buildDeploymentCapabilities lists canonical tool ids in stable order", async () => {
  await withEnv(
    {
      VERCEL: undefined,
      AI_GATEWAY_API_KEY: "k",
    },
    async () => {
      const { buildDeploymentCapabilitiesSync } = await import(
        "../../lib/deployment/capabilities"
      );
      const c = buildDeploymentCapabilitiesSync();
      assert.equal(c.agentTools.length, 8);
      assert.equal(c.agentTools[0]?.id, "getBriefing");
      assert.equal(c.agentTools.at(-1)?.id, "updateJiraIssue");
    }
  );
});

test("buildDeploymentCapabilities accepts bypassDelegationCache without throwing", async () => {
  await withEnv(
    {
      VERCEL: undefined,
      AI_GATEWAY_API_KEY: "k",
      HERMES_HTTP_URL: undefined,
      OPENCLAW_HTTP_URL: undefined,
      OPENCLAW_URL: undefined,
    },
    async () => {
      const { buildDeploymentCapabilities } = await import(
        "../../lib/deployment/capabilities"
      );
      const c = await buildDeploymentCapabilities({
        bypassDelegationCache: true,
      });
      assert.equal(c.environment, "local");
      assert.ok(c.delegation);
      assert.equal(typeof c.delegation?.configured, "boolean");
    }
  );
});
