import assert from "node:assert/strict";
import test from "node:test";
import {
  getDelegationPollWaitMs,
  getDelegationWorkerSecret,
  isDelegationPollPrimaryActive,
  isDelegationPollPrimaryEnabled,
} from "@/lib/integrations/delegation-poll-config";

const KEYS = [
  "VIRGIL_DELEGATION_POLL_PRIMARY",
  "VIRGIL_DELEGATION_WORKER_SECRET",
  "HERMES_SHARED_SECRET",
  "VIRGIL_DELEGATION_POLL_WAIT_MS",
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
      const value = saved[key];
      if (value === undefined) {
        Reflect.deleteProperty(process.env, key);
      } else {
        process.env[key] = value;
      }
    }
  }
}

test("poll primary enabled when env is truthy", () => {
  withEnv({ VIRGIL_DELEGATION_POLL_PRIMARY: "1" }, () => {
    assert.equal(isDelegationPollPrimaryEnabled(), true);
  });
  withEnv({ VIRGIL_DELEGATION_POLL_PRIMARY: undefined }, () => {
    assert.equal(isDelegationPollPrimaryEnabled(), false);
  });
});

test("poll primary active requires enabled and a secret", () => {
  withEnv(
    {
      VIRGIL_DELEGATION_POLL_PRIMARY: "1",
      VIRGIL_DELEGATION_WORKER_SECRET: "secret",
    },
    () => {
      assert.equal(isDelegationPollPrimaryActive(), true);
    }
  );
  withEnv(
    {
      VIRGIL_DELEGATION_POLL_PRIMARY: "1",
      VIRGIL_DELEGATION_WORKER_SECRET: undefined,
      HERMES_SHARED_SECRET: "legacy",
    },
    () => {
      assert.equal(getDelegationWorkerSecret(), "legacy");
      assert.equal(isDelegationPollPrimaryActive(), true);
    }
  );
  withEnv(
    {
      VIRGIL_DELEGATION_POLL_PRIMARY: "1",
      VIRGIL_DELEGATION_WORKER_SECRET: undefined,
      HERMES_SHARED_SECRET: undefined,
    },
    () => {
      assert.equal(isDelegationPollPrimaryActive(), false);
    }
  );
});

test("getDelegationPollWaitMs caps and parses", () => {
  withEnv({ VIRGIL_DELEGATION_POLL_WAIT_MS: "5000" }, () => {
    assert.equal(getDelegationPollWaitMs(), 5000);
  });
  withEnv({ VIRGIL_DELEGATION_POLL_WAIT_MS: "999999" }, () => {
    assert.equal(getDelegationPollWaitMs(), 60_000);
  });
  withEnv({ VIRGIL_DELEGATION_POLL_WAIT_MS: undefined }, () => {
    assert.equal(getDelegationPollWaitMs(), 0);
  });
});
