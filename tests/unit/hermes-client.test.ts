import assert from "node:assert/strict";
import test from "node:test";
import {
  listHermesSkillNames,
  pingHermes,
  sendHermesIntent,
} from "../../lib/integrations/hermes-client";
import type { ClawIntent } from "../../lib/integrations/openclaw-types";

const ENV_KEYS = [
  "HERMES_HTTP_URL",
  "HERMES_EXECUTE_PATH",
  "HERMES_SKILLS_PATH",
  "HERMES_HEALTH_PATH",
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

const DEFAULT_INTENT: ClawIntent = {
  skill: "generic-task",
  params: { description: "do the thing" },
  priority: "normal",
  source: "chat",
  requiresConfirmation: false,
};

test("pingHermes returns false when base URL missing", async () => {
  await withEnv(
    {
      HERMES_HTTP_URL: undefined,
      HERMES_HEALTH_PATH: undefined,
      HERMES_SHARED_SECRET: undefined,
    },
    async () => {
      assert.equal(await pingHermes(), false);
    }
  );
});

test("pingHermes calls configured health endpoint", async () => {
  await withEnv(
    {
      HERMES_HTTP_URL: "http://127.0.0.1:8765",
      HERMES_HEALTH_PATH: "/healthz",
      HERMES_SHARED_SECRET: undefined,
    },
    async () => {
      const originalFetch = globalThis.fetch;
      const seenUrls: string[] = [];
      globalThis.fetch = ((input: string | URL | Request) => {
        const url =
          typeof input === "string"
            ? input
            : input instanceof URL
              ? input.toString()
              : input.url;
        seenUrls.push(url);
        return Promise.resolve(new Response("ok", { status: 200 }));
      }) as typeof fetch;

      try {
        const online = await pingHermes();
        assert.equal(online, true);
        assert.deepEqual(seenUrls, ["http://127.0.0.1:8765/healthz"]);
      } finally {
        globalThis.fetch = originalFetch;
      }
    }
  );
});

test("pingHermes includes bearer auth when shared secret set", async () => {
  await withEnv(
    {
      HERMES_HTTP_URL: "http://127.0.0.1:8765",
      HERMES_HEALTH_PATH: "/health",
      HERMES_SHARED_SECRET: "secret-token",
    },
    async () => {
      const originalFetch = globalThis.fetch;
      const authHeaders: Array<string | null> = [];
      globalThis.fetch = ((
        _input: string | URL | Request,
        init?: RequestInit
      ) => {
        const headers = new Headers(init?.headers);
        authHeaders.push(headers.get("authorization"));
        return Promise.resolve(new Response("ok", { status: 200 }));
      }) as typeof fetch;

      try {
        const online = await pingHermes();
        assert.equal(online, true);
        assert.deepEqual(authHeaders, ["Bearer secret-token"]);
      } finally {
        globalThis.fetch = originalFetch;
      }
    }
  );
});

test("sendHermesIntent returns configured error when base URL missing", async () => {
  await withEnv(
    {
      HERMES_HTTP_URL: undefined,
      HERMES_EXECUTE_PATH: undefined,
      HERMES_SHARED_SECRET: undefined,
    },
    async () => {
      const result = await sendHermesIntent(DEFAULT_INTENT);
      assert.equal(result.success, false);
      assert.equal(result.error, "Hermes HTTP base URL is not configured.");
    }
  );
});

test("sendHermesIntent posts to execute path with auth header", async () => {
  await withEnv(
    {
      HERMES_HTTP_URL: "http://127.0.0.1:8765",
      HERMES_EXECUTE_PATH: "/v2/execute",
      HERMES_SHARED_SECRET: "secret-token",
    },
    async () => {
      const originalFetch = globalThis.fetch;
      const requests: Array<{
        url: string;
        auth: string | null;
        body: string | null;
      }> = [];
      globalThis.fetch = ((
        input: string | URL | Request,
        init?: RequestInit
      ) => {
        const url =
          typeof input === "string"
            ? input
            : input instanceof URL
              ? input.toString()
              : input.url;
        const headers = new Headers(init?.headers);
        requests.push({
          url,
          auth: headers.get("authorization"),
          body:
            typeof init?.body === "string"
              ? init.body
              : init?.body
                ? String(init.body)
                : null,
        });
        return Promise.resolve(
          new Response(JSON.stringify({ output: "sent" }), { status: 200 })
        );
      }) as typeof fetch;

      try {
        const result = await sendHermesIntent(DEFAULT_INTENT);
        assert.equal(result.success, true);
        assert.equal(result.output, "sent");
        assert.deepEqual(requests, [
          {
            url: "http://127.0.0.1:8765/v2/execute",
            auth: "Bearer secret-token",
            body: JSON.stringify(DEFAULT_INTENT),
          },
        ]);
      } finally {
        globalThis.fetch = originalFetch;
      }
    }
  );
});

test("sendHermesIntent sanitizes and truncates non-2xx error payload", async () => {
  await withEnv(
    {
      HERMES_HTTP_URL: "http://127.0.0.1:8765",
      HERMES_EXECUTE_PATH: "/api/execute",
      HERMES_SHARED_SECRET: undefined,
    },
    async () => {
      const originalFetch = globalThis.fetch;
      const raw = `<b>blocked</b>${"x".repeat(700)}`;
      globalThis.fetch = (() =>
        Promise.resolve(new Response(raw, { status: 403 }))) as typeof fetch;

      try {
        const result = await sendHermesIntent(DEFAULT_INTENT);
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

test("listHermesSkillNames returns [] when base URL missing", async () => {
  await withEnv(
    {
      HERMES_HTTP_URL: undefined,
      HERMES_SKILLS_PATH: undefined,
      HERMES_SHARED_SECRET: undefined,
    },
    async () => {
      assert.deepEqual(await listHermesSkillNames(), []);
    }
  );
});

test("listHermesSkillNames parses mixed skill payloads", async () => {
  await withEnv(
    {
      HERMES_HTTP_URL: "http://127.0.0.1:8765",
      HERMES_SKILLS_PATH: "/api/skills",
      HERMES_SHARED_SECRET: "secret-token",
    },
    async () => {
      const originalFetch = globalThis.fetch;
      const seenAuthHeaders: Array<string | null> = [];
      globalThis.fetch = ((
        _input: string | URL | Request,
        init?: RequestInit
      ) => {
        const headers = new Headers(init?.headers);
        seenAuthHeaders.push(headers.get("authorization"));
        return Promise.resolve(
          new Response(
            JSON.stringify({
              skills: [
                "send-whatsapp",
                { id: "read-email" },
                { name: "send-whatsapp" },
                { slug: "open-calendar" },
                { ignored: true },
              ],
            }),
            { status: 200 }
          )
        );
      }) as typeof fetch;

      try {
        const skills = await listHermesSkillNames();
        assert.deepEqual(skills, [
          "send-whatsapp",
          "read-email",
          "open-calendar",
        ]);
        assert.deepEqual(seenAuthHeaders, ["Bearer secret-token"]);
      } finally {
        globalThis.fetch = originalFetch;
      }
    }
  );
});
