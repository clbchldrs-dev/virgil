import assert from "node:assert/strict";
import test from "node:test";
import {
  getDelegationProvider,
  isDelegationConfigured,
  isDelegationFailoverEnabled,
} from "@/lib/integrations/delegation-provider";

const KEYS = [
  "VIRGIL_DELEGATION_BACKEND",
  "VIRGIL_DELEGATION_FAILOVER",
  "VIRGIL_DELEGATION_POLL_PRIMARY",
  "VIRGIL_DELEGATION_WORKER_SECRET",
  "OPENCLAW_URL",
  "OPENCLAW_HTTP_URL",
  "HERMES_HTTP_URL",
] as const;

async function withEnv(
  overrides: Partial<Record<(typeof KEYS)[number], string | undefined>>,
  fn: () => Promise<void> | void
): Promise<void> {
  const saved: Record<string, string | undefined> = {};
  for (const key of KEYS) {
    saved[key] = process.env[key];
  }
  for (const [key, value] of Object.entries(overrides)) {
    if (value === undefined) {
      Reflect.deleteProperty(process.env, key);
    } else {
      process.env[key] = value;
    }
  }
  try {
    await fn();
  } finally {
    for (const key of KEYS) {
      const value = saved[key];
      if (value === undefined) {
        Reflect.deleteProperty(process.env, key);
      } else {
        process.env[key] = value;
      }
    }
  }
}

test("delegation provider defaults to hermes", () => {
  withEnv(
    {
      VIRGIL_DELEGATION_BACKEND: undefined,
      HERMES_HTTP_URL: undefined,
      OPENCLAW_URL: undefined,
      OPENCLAW_HTTP_URL: undefined,
    },
    () => {
      const provider = getDelegationProvider();
      assert.equal(provider.backend, "hermes");
    }
  );
});

test("delegation provider falls back to openclaw when hermes is unresolvable", () => {
  // Since the in-app Hermes bridge is the default (`HERMES_HTTP_URL` unset
  // resolves to `http://127.0.0.1:PORT`), the only way to represent a
  // "missing hermes" scenario is an explicitly invalid `HERMES_HTTP_URL`
  // (normalizeHttpOrigin returns null for non-http(s) values).
  withEnv(
    {
      VIRGIL_DELEGATION_BACKEND: undefined,
      HERMES_HTTP_URL: "ftp://invalid.example",
      OPENCLAW_URL: "ws://host:13100",
      OPENCLAW_HTTP_URL: undefined,
    },
    () => {
      const provider = getDelegationProvider();
      assert.equal(provider.backend, "openclaw");
    }
  );
});

test("delegation provider prefers hermes when both are configured", () => {
  withEnv(
    {
      VIRGIL_DELEGATION_BACKEND: undefined,
      HERMES_HTTP_URL: "http://host:8765",
      OPENCLAW_URL: "ws://host:13100",
      OPENCLAW_HTTP_URL: "http://host:13100",
    },
    () => {
      const provider = getDelegationProvider();
      assert.equal(provider.backend, "hermes");
    }
  );
});

test("delegation configured follows OpenClaw config on default backend", () => {
  withEnv(
    {
      VIRGIL_DELEGATION_BACKEND: undefined,
      OPENCLAW_URL: "ws://host:13100",
      OPENCLAW_HTTP_URL: undefined,
      HERMES_HTTP_URL: undefined,
    },
    () => {
      assert.equal(isDelegationConfigured(), true);
    }
  );
});

test("delegation configured when poll primary active without HTTP bridges", () => {
  withEnv(
    {
      VIRGIL_DELEGATION_BACKEND: undefined,
      VIRGIL_DELEGATION_POLL_PRIMARY: "1",
      VIRGIL_DELEGATION_WORKER_SECRET: "worker-secret",
      OPENCLAW_URL: undefined,
      OPENCLAW_HTTP_URL: undefined,
      HERMES_HTTP_URL: undefined,
    },
    () => {
      assert.equal(isDelegationConfigured(), true);
    }
  );
});

test("delegation failover auto-enables when both bridges configured", () => {
  withEnv(
    {
      VIRGIL_DELEGATION_BACKEND: undefined,
      VIRGIL_DELEGATION_FAILOVER: undefined,
      HERMES_HTTP_URL: "http://host:8765",
      OPENCLAW_URL: "ws://host:13100",
      OPENCLAW_HTTP_URL: "http://host:13100",
    },
    () => {
      assert.equal(isDelegationFailoverEnabled(), true);
    }
  );
});

test("delegation failover can be disabled explicitly", () => {
  withEnv(
    {
      VIRGIL_DELEGATION_BACKEND: undefined,
      VIRGIL_DELEGATION_FAILOVER: "0",
      HERMES_HTTP_URL: "http://host:8765",
      OPENCLAW_URL: "ws://host:13100",
      OPENCLAW_HTTP_URL: "http://host:13100",
    },
    () => {
      assert.equal(isDelegationFailoverEnabled(), false);
    }
  );
});

test("delegation failover off when only one bridge configured", () => {
  withEnv(
    {
      VIRGIL_DELEGATION_BACKEND: undefined,
      VIRGIL_DELEGATION_FAILOVER: undefined,
      HERMES_HTTP_URL: "http://host:8765",
      OPENCLAW_URL: undefined,
      OPENCLAW_HTTP_URL: undefined,
    },
    () => {
      assert.equal(isDelegationFailoverEnabled(), false);
    }
  );
});

test("hermes backend routes through provider contract", async () => {
  await withEnv(
    {
      VIRGIL_DELEGATION_BACKEND: "hermes",
      OPENCLAW_URL: "ws://host:13100",
      OPENCLAW_HTTP_URL: "http://host:13100",
      // Force the "hermes not configured" code path even though the in-app
      // bridge would otherwise be the default. normalizeHttpOrigin rejects
      // non-http(s) protocols.
      HERMES_HTTP_URL: "ftp://invalid.example",
    },
    async () => {
      const provider = getDelegationProvider();
      assert.equal(provider.backend, "hermes");
      assert.equal(provider.isConfigured(), false);
      assert.equal(await provider.ping(), false);
      assert.deepEqual(await provider.listSkillNames(), []);
      const result = await provider.sendIntent({
        skill: "test",
        params: {},
        priority: "normal",
        source: "chat",
        requiresConfirmation: false,
      });
      assert.equal(result.success, false);
      assert.equal(result.error, "Hermes HTTP base URL is not configured.");
    }
  );
});
