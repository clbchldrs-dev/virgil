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
  "OPENCLAW_URL",
  "OPENCLAW_HTTP_URL",
  "HERMES_HTTP_URL",
] as const;

function withEnv(
  overrides: Partial<Record<(typeof KEYS)[number], string | undefined>>,
  fn: () => Promise<void> | void
) {
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
    return fn();
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

test("delegation provider falls back to openclaw when hermes missing", () => {
  withEnv(
    {
      VIRGIL_DELEGATION_BACKEND: undefined,
      HERMES_HTTP_URL: undefined,
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
      HERMES_HTTP_URL: undefined,
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
