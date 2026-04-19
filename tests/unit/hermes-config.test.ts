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
  "NEXT_PUBLIC_APP_URL",
  "VERCEL_URL",
  "PORT",
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

test("Hermes defaults to the in-app bridge when HTTP URL is missing", () => {
  withEnv(
    { HERMES_HTTP_URL: undefined, VERCEL_URL: undefined, PORT: undefined },
    () => {
      assert.equal(getHermesHttpOrigin(), "http://127.0.0.1:3000");
      assert.equal(isHermesConfigured(), true);
    }
  );
});

test("Hermes in-app default honors PORT", () => {
  withEnv(
    {
      HERMES_HTTP_URL: undefined,
      VERCEL_URL: undefined,
      NEXT_PUBLIC_APP_URL: undefined,
      PORT: "4000",
    },
    () => {
      assert.equal(getHermesHttpOrigin(), "http://127.0.0.1:4000");
    }
  );
});

test("Hermes in-app default honors NEXT_PUBLIC_APP_URL", () => {
  withEnv(
    {
      HERMES_HTTP_URL: undefined,
      VERCEL_URL: undefined,
      NEXT_PUBLIC_APP_URL: "https://app.example.com/",
    },
    () => {
      assert.equal(getHermesHttpOrigin(), "https://app.example.com");
    }
  );
});

test("Hermes in-app default uses VERCEL_URL over NEXT_PUBLIC_APP_URL", () => {
  withEnv(
    {
      HERMES_HTTP_URL: undefined,
      VERCEL_URL: "myapp-abc123.vercel.app",
      NEXT_PUBLIC_APP_URL: "https://other.example.com",
    },
    () => {
      assert.equal(getHermesHttpOrigin(), "https://myapp-abc123.vercel.app");
    }
  );
});

test("Hermes config normalizes explicit URL to origin", () => {
  withEnv(
    { HERMES_HTTP_URL: "https://example.internal:8765/api/health?x=1" },
    () => {
      assert.equal(getHermesHttpOrigin(), "https://example.internal:8765");
      assert.equal(isHermesConfigured(), true);
    }
  );
});

test("Hermes config falls back to in-app when explicit URL has unsupported protocol", () => {
  withEnv(
    {
      HERMES_HTTP_URL: "ftp://example.internal",
      VERCEL_URL: undefined,
      PORT: undefined,
      NEXT_PUBLIC_APP_URL: undefined,
    },
    () => {
      // Unsupported protocol => explicit value rejected => origin is null
      // (we do NOT silently fall back to in-app when the user intentionally
      // set a malformed value).
      assert.equal(getHermesHttpOrigin(), null);
      assert.equal(isHermesConfigured(), false);
    }
  );
});

test("Hermes path helpers default to in-app bridge paths", () => {
  withEnv(
    {
      HERMES_EXECUTE_PATH: undefined,
      HERMES_PENDING_PATH: undefined,
      HERMES_SKILLS_PATH: undefined,
      HERMES_HEALTH_PATH: undefined,
    },
    () => {
      assert.equal(getHermesExecutePath(), "/api/hermes-bridge/execute");
      assert.equal(getHermesPendingPath(), "/api/hermes-bridge/pending");
      assert.equal(getHermesSkillsPath(), "/api/hermes-bridge/skills");
      assert.equal(getHermesHealthPath(), "/api/hermes-bridge/health");
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
