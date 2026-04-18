import assert from "node:assert/strict";
import test from "node:test";
import {
  buildHermesStubOutput,
  hermesBridgeStubEnabled,
  isHermesBridgeRequestAuthorized,
} from "../../lib/integrations/hermes-bridge-stub";

const ENV_KEYS = [
  "VIRGIL_HERMES_BRIDGE_STUB_ENABLED",
  "HERMES_SHARED_SECRET",
] as const;

function withEnv(
  overrides: Partial<Record<(typeof ENV_KEYS)[number], string | undefined>>,
  fn: () => Promise<void> | void
) {
  const saved: Record<string, string | undefined> = {};
  for (const key of ENV_KEYS) {
    saved[key] = process.env[key];
  }
  for (const [key, value] of Object.entries(overrides)) {
    if (value === undefined) {
      Reflect.deleteProperty(process.env, key);
    } else {
      process.env[key] = value;
    }
  }
  return Promise.resolve()
    .then(fn)
    .finally(() => {
      for (const key of ENV_KEYS) {
        if (saved[key] === undefined) {
          Reflect.deleteProperty(process.env, key);
        } else {
          process.env[key] = saved[key];
        }
      }
    });
}

test("hermesBridgeStubEnabled returns true only when set to 1", async () => {
  await withEnv({ VIRGIL_HERMES_BRIDGE_STUB_ENABLED: "1" }, () => {
    assert.equal(hermesBridgeStubEnabled(), true);
  });

  await withEnv({ VIRGIL_HERMES_BRIDGE_STUB_ENABLED: "0" }, () => {
    assert.equal(hermesBridgeStubEnabled(), false);
  });

  await withEnv({ VIRGIL_HERMES_BRIDGE_STUB_ENABLED: undefined }, () => {
    assert.equal(hermesBridgeStubEnabled(), false);
  });
});

test("isHermesBridgeRequestAuthorized allows requests when no shared secret is set", async () => {
  await withEnv({ HERMES_SHARED_SECRET: undefined }, () => {
    const request = new Request("http://localhost:3000/api/hermes/execute");
    assert.equal(isHermesBridgeRequestAuthorized(request), true);
  });
});

test("isHermesBridgeRequestAuthorized requires matching bearer token when shared secret is set", async () => {
  await withEnv({ HERMES_SHARED_SECRET: "bridge-secret" }, () => {
    const authorized = new Request("http://localhost:3000/api/hermes/execute", {
      headers: { Authorization: "Bearer bridge-secret" },
    });
    const unauthorized = new Request(
      "http://localhost:3000/api/hermes/execute",
      {
        headers: { Authorization: "Bearer wrong" },
      }
    );
    assert.equal(isHermesBridgeRequestAuthorized(authorized), true);
    assert.equal(isHermesBridgeRequestAuthorized(unauthorized), false);
  });
});

test("buildHermesStubOutput includes delegated skill and description", () => {
  const output = buildHermesStubOutput({
    skill: "send-slack-message",
    params: { description: "Post sprint update" },
  });
  assert.match(output, /send-slack-message/);
  assert.match(output, /Post sprint update/);
  assert.match(output, /stub/i);
});

test("buildHermesStubOutput falls back when description is missing", () => {
  const output = buildHermesStubOutput({
    skill: "unknown-skill",
    params: {},
  });
  assert.match(output, /unknown-skill/);
  assert.match(output, /No description provided/);
});
