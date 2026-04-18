import assert from "node:assert/strict";
import test from "node:test";
import { getDelegationProvider } from "@/lib/integrations/delegation-provider";
import { pendingIntentBlocksImmediateSend } from "@/lib/integrations/openclaw-queue-gate";

const ENV_KEYS = [
  "VIRGIL_DELEGATION_BACKEND",
  "OPENCLAW_URL",
  "OPENCLAW_HTTP_URL",
  "HERMES_HTTP_URL",
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
        const value = saved[key];
        if (value === undefined) {
          Reflect.deleteProperty(process.env, key);
        } else {
          process.env[key] = value;
        }
      }
    });
}

const PENDING_CONFIRMATION_ROW = {
  requiresConfirmation: true,
  status: "pending",
} as const;

const CONFIRMED_ROW = {
  requiresConfirmation: true,
  status: "confirmed",
} as const;

test("approval gate parity: pending confirmation blocks send for OpenClaw backend", async () => {
  await withEnv(
    {
      VIRGIL_DELEGATION_BACKEND: "openclaw",
      OPENCLAW_HTTP_URL: "http://127.0.0.1:13100",
      OPENCLAW_URL: "ws://127.0.0.1:13100",
      HERMES_HTTP_URL: undefined,
    },
    () => {
      const provider = getDelegationProvider();
      assert.equal(provider.backend, "openclaw");
      assert.equal(
        pendingIntentBlocksImmediateSend(PENDING_CONFIRMATION_ROW),
        true
      );
      assert.equal(pendingIntentBlocksImmediateSend(CONFIRMED_ROW), false);
    }
  );
});

test("approval gate parity: pending confirmation blocks send for Hermes backend", async () => {
  await withEnv(
    {
      VIRGIL_DELEGATION_BACKEND: "hermes",
      HERMES_HTTP_URL: "http://127.0.0.1:8765",
      OPENCLAW_HTTP_URL: "http://127.0.0.1:13100",
      OPENCLAW_URL: "ws://127.0.0.1:13100",
    },
    () => {
      const provider = getDelegationProvider();
      assert.equal(provider.backend, "hermes");
      assert.equal(
        pendingIntentBlocksImmediateSend(PENDING_CONFIRMATION_ROW),
        true
      );
      assert.equal(pendingIntentBlocksImmediateSend(CONFIRMED_ROW), false);
    }
  );
});
