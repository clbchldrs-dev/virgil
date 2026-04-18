import assert from "node:assert/strict";
import test from "node:test";
import {
  getHermesExecutePath,
  getHermesHealthPath,
  getHermesHttpOrigin,
  getHermesPendingPath,
  getHermesSharedSecret,
  getHermesSkillsPath,
  isHermesConfigured,
} from "../../lib/integrations/hermes-config";

const KEYS = [
  "HERMES_HTTP_URL",
  "HERMES_EXECUTE_PATH",
  "HERMES_PENDING_PATH",
  "HERMES_SKILLS_PATH",
  "HERMES_HEALTH_PATH",
  "HERMES_SHARED_SECRET",
] as const;

function withEnv(
  overrides: Partial<Record<(typeof KEYS)[number], string | undefined>>,
  fn: () => void
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
    fn();
  } finally {
    for (const key of KEYS) {
      if (saved[key] === undefined) {
        Reflect.deleteProperty(process.env, key);
      } else {
        process.env[key] = saved[key];
      }
    }
  }
}

test("Hermes config returns null and false when HTTP URL missing", () => {
  withEnv({ HERMES_HTTP_URL: undefined }, () => {
    assert.equal(getHermesHttpOrigin(), null);
    assert.equal(isHermesConfigured(), false);
  });
});

test("Hermes config normalizes URL to origin", () => {
  withEnv(
    { HERMES_HTTP_URL: "https://example.internal:8765/api/health?x=1" },
    () => {
      assert.equal(getHermesHttpOrigin(), "https://example.internal:8765");
      assert.equal(isHermesConfigured(), true);
    }
  );
});

test("Hermes config rejects unsupported protocols", () => {
  withEnv({ HERMES_HTTP_URL: "ftp://example.internal" }, () => {
    assert.equal(getHermesHttpOrigin(), null);
    assert.equal(isHermesConfigured(), false);
  });
});

test("Hermes path helpers return defaults", () => {
  withEnv(
    {
      HERMES_EXECUTE_PATH: undefined,
      HERMES_PENDING_PATH: undefined,
      HERMES_SKILLS_PATH: undefined,
      HERMES_HEALTH_PATH: undefined,
    },
    () => {
      assert.equal(getHermesExecutePath(), "/api/execute");
      assert.equal(getHermesPendingPath(), "/api/pending");
      assert.equal(getHermesSkillsPath(), "/api/skills");
      assert.equal(getHermesHealthPath(), "/health");
    }
  );
});

test("Hermes path helpers use env overrides", () => {
  withEnv(
    {
      HERMES_EXECUTE_PATH: "/v2/execute",
      HERMES_PENDING_PATH: "/v2/pending",
      HERMES_SKILLS_PATH: "/v2/skills",
      HERMES_HEALTH_PATH: "/v2/health",
    },
    () => {
      assert.equal(getHermesExecutePath(), "/v2/execute");
      assert.equal(getHermesPendingPath(), "/v2/pending");
      assert.equal(getHermesSkillsPath(), "/v2/skills");
      assert.equal(getHermesHealthPath(), "/v2/health");
    }
  );
});

test("Hermes shared secret is optional and trimmed", () => {
  withEnv({ HERMES_SHARED_SECRET: undefined }, () => {
    assert.equal(getHermesSharedSecret(), null);
  });
  withEnv({ HERMES_SHARED_SECRET: "  token-123  " }, () => {
    assert.equal(getHermesSharedSecret(), "token-123");
  });
});
