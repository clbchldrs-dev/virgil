import assert from "node:assert/strict";
import test from "node:test";

import {
  pingOpenClaw,
  sendOpenClawIntent,
} from "../../lib/integrations/openclaw-client";
import type { ClawIntent } from "../../lib/integrations/openclaw-types";

const ENV_KEYS = [
  "OPENCLAW_URL",
  "OPENCLAW_HTTP_URL",
  "OPENCLAW_HEALTH_PATH",
] as const;

function withEnv(
  overrides: Partial<Record<(typeof ENV_KEYS)[number], string | undefined>>,
  fn: () => Promise<void> | void
) {
  const saved: Record<string, string | undefined> = {};
  for (const k of ENV_KEYS) {
    saved[k] = process.env[k];
  }
  for (const [k, v] of Object.entries(overrides)) {
    if (v === undefined) {
      Reflect.deleteProperty(process.env, k);
    } else {
      process.env[k] = v;
    }
  }
  return Promise.resolve()
    .then(fn)
    .finally(() => {
      for (const k of ENV_KEYS) {
        if (saved[k] === undefined) {
          Reflect.deleteProperty(process.env, k);
        } else {
          process.env[k] = saved[k];
        }
      }
    });
}

const DEFAULT_INTENT: ClawIntent = {
  skill: "generic-task",
  params: { description: "do the thing" },
  priority: "normal",
  source: "chat",
  requiresConfirmation: false,
};

test("sendOpenClawIntent returns configured error when base URL missing", async () => {
  await withEnv(
    { OPENCLAW_URL: undefined, OPENCLAW_HTTP_URL: undefined },
    async () => {
      const result = await sendOpenClawIntent(DEFAULT_INTENT);
      assert.equal(result.success, false);
      assert.equal(result.error, "OpenClaw HTTP base URL is not configured.");
    }
  );
});

test("pingOpenClaw falls back to /api/health when configured health path fails", async () => {
  await withEnv(
    {
      OPENCLAW_HTTP_URL: "http://127.0.0.1:13100",
      OPENCLAW_HEALTH_PATH: "/healthz",
      OPENCLAW_URL: undefined,
    },
    async () => {
      const seenUrls: string[] = [];
      const originalFetch = globalThis.fetch;
      let calls = 0;
      globalThis.fetch = ((input: string | URL | Request) => {
        const url =
          typeof input === "string"
            ? input
            : input instanceof URL
              ? input.toString()
              : input.url;
        seenUrls.push(url);
        calls += 1;
        if (calls === 1) {
          throw new Error("primary health endpoint down");
        }
        return Promise.resolve(new Response("ok", { status: 200 }));
      }) as typeof fetch;

      try {
        const online = await pingOpenClaw();
        assert.equal(online, true);
        assert.deepEqual(seenUrls, [
          "http://127.0.0.1:13100/healthz",
          "http://127.0.0.1:13100/api/health",
        ]);
      } finally {
        globalThis.fetch = originalFetch;
      }
    }
  );
});

test("sendOpenClawIntent sanitizes and truncates error text from non-2xx responses", async () => {
  await withEnv(
    { OPENCLAW_HTTP_URL: "http://127.0.0.1:13100", OPENCLAW_URL: undefined },
    async () => {
      const originalFetch = globalThis.fetch;
      const raw = `<b>very bad</b>${"x".repeat(700)}`;
      globalThis.fetch = (() =>
        Promise.resolve(new Response(raw, { status: 500 }))) as typeof fetch;

      try {
        const result = await sendOpenClawIntent(DEFAULT_INTENT);
        assert.equal(result.success, false);
        assert.ok(result.error);
        assert.equal(result.error?.includes("<b>"), false);
        assert.ok((result.error?.length ?? 0) <= 501);
      } finally {
        globalThis.fetch = originalFetch;
      }
    }
  );
});
