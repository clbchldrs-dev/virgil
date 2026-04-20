import assert from "node:assert/strict";
import test from "node:test";
import {
  bridgeExecute,
  isBridgeRequestAuthorized,
  parseBridgeIntent,
} from "../../lib/integrations/hermes-bridge";

test("parseBridgeIntent rejects missing skill", () => {
  const out = parseBridgeIntent({ params: {} });
  assert.equal(out, null);
});

test("parseBridgeIntent defaults priority/source/requiresConfirmation", () => {
  const out = parseBridgeIntent({
    skill: "generic-task",
    params: { description: "Do the thing" },
  });
  assert.ok(out);
  assert.equal(out?.skill, "generic-task");
  assert.equal(out?.priority, "normal");
  assert.equal(out?.source, "chat");
  assert.equal(out?.requiresConfirmation, false);
});

test("parseBridgeIntent accepts explicit valid priorities", () => {
  for (const priority of ["low", "normal", "high"] as const) {
    const out = parseBridgeIntent({
      skill: "x",
      params: {},
      priority,
    });
    assert.equal(out?.priority, priority);
  }
});

test("parseBridgeIntent rejects invalid priority", () => {
  const out = parseBridgeIntent({
    skill: "x",
    params: {},
    priority: "sky-high",
  });
  assert.equal(out, null);
});

test("isBridgeRequestAuthorized allows requests when HERMES_SHARED_SECRET is unset", () => {
  const saved = process.env.HERMES_SHARED_SECRET;
  Reflect.deleteProperty(process.env, "HERMES_SHARED_SECRET");
  try {
    const req = new Request("http://127.0.0.1:3000/api/hermes-bridge/health");
    assert.equal(isBridgeRequestAuthorized(req), true);
  } finally {
    if (saved !== undefined) {
      process.env.HERMES_SHARED_SECRET = saved;
    }
  }
});

test("isBridgeRequestAuthorized requires matching bearer when secret is set", () => {
  const saved = process.env.HERMES_SHARED_SECRET;
  process.env.HERMES_SHARED_SECRET = "shhh";
  try {
    const bad = new Request("http://127.0.0.1:3000/api/hermes-bridge/health", {
      headers: { Authorization: "Bearer wrong" },
    });
    const good = new Request("http://127.0.0.1:3000/api/hermes-bridge/health", {
      headers: { Authorization: "Bearer shhh" },
    });
    assert.equal(isBridgeRequestAuthorized(bad), false);
    assert.equal(isBridgeRequestAuthorized(good), true);
  } finally {
    if (saved === undefined) {
      Reflect.deleteProperty(process.env, "HERMES_SHARED_SECRET");
    } else {
      process.env.HERMES_SHARED_SECRET = saved;
    }
  }
});

function withOpenClawEnv(
  fn: () => Promise<void> | void,
  overrides: Partial<Record<string, string | undefined>>
) {
  const keys = [
    "OPENCLAW_HTTP_URL",
    "OPENCLAW_EXECUTE_PATH",
    "OPENCLAW_SKILLS_PATH",
    "OPENCLAW_SKILLS_STATIC",
    "OPENCLAW_GATEWAY_TOOLS_INVOKE",
    "OPENCLAW_GENERIC_TASK_TOOL",
  ] as const;
  const saved: Record<string, string | undefined> = {};
  for (const key of keys) {
    saved[key] = process.env[key];
  }
  for (const key of keys) {
    const next = overrides[key];
    if (next === undefined) {
      Reflect.deleteProperty(process.env, key);
    } else {
      process.env[key] = next;
    }
  }
  const restore = () => {
    for (const key of keys) {
      const prev = saved[key];
      if (prev === undefined) {
        Reflect.deleteProperty(process.env, key);
      } else {
        process.env[key] = prev;
      }
    }
  };
  return Promise.resolve(fn()).finally(restore);
}

test("bridgeExecute fails fast when no invoke tools are advertised", async () => {
  await withOpenClawEnv(
    async () => {
      const originalFetch = global.fetch;
      let executeCalled = false;
      global.fetch = (input: string | URL | Request): Promise<Response> => {
        const url = String(input);
        if (url.endsWith("/v1/skills")) {
          return Promise.resolve(
            new Response("<html>skills ui</html>", {
              status: 200,
              headers: { "content-type": "text/html" },
            })
          );
        }
        executeCalled = true;
        return Promise.reject(new Error("execute should not be called"));
      };
      try {
        const out = await bridgeExecute({
          skill: "generic-task",
          params: { description: "submit check-in" },
          priority: "normal",
          source: "agent-task",
          requiresConfirmation: false,
        });
        assert.equal(out.status, 503);
        assert.equal(out.body.success, false);
        assert.match(out.body.error ?? "", /No OpenClaw tools are advertised/i);
        assert.equal(executeCalled, false);
      } finally {
        global.fetch = originalFetch;
      }
    },
    {
      OPENCLAW_HTTP_URL: "http://openclaw.test",
      OPENCLAW_EXECUTE_PATH: "/tools/invoke",
      OPENCLAW_SKILLS_PATH: "/v1/skills",
      OPENCLAW_SKILLS_STATIC: undefined,
      OPENCLAW_GATEWAY_TOOLS_INVOKE: "1",
      OPENCLAW_GENERIC_TASK_TOOL: "web",
    }
  );
});

test("bridgeExecute fails fast when mapped tool is not advertised", async () => {
  await withOpenClawEnv(
    async () => {
      const originalFetch = global.fetch;
      let executeCalled = false;
      global.fetch = (input: string | URL | Request): Promise<Response> => {
        const url = String(input);
        if (url.endsWith("/v1/skills")) {
          return Promise.resolve(
            Response.json({ skills: ["sessions_list"] }, { status: 200 })
          );
        }
        executeCalled = true;
        return Promise.reject(new Error("execute should not be called"));
      };
      try {
        const out = await bridgeExecute({
          skill: "generic-task",
          params: { description: "submit check-in" },
          priority: "normal",
          source: "agent-task",
          requiresConfirmation: false,
        });
        assert.equal(out.status, 503);
        assert.equal(out.body.success, false);
        assert.match(
          out.body.error ?? "",
          /Mapped tool "web" is not advertised/i
        );
        assert.match(out.body.error ?? "", /sessions_list/);
        assert.equal(out.body.openClawTool, "web");
        assert.equal(executeCalled, false);
      } finally {
        global.fetch = originalFetch;
      }
    },
    {
      OPENCLAW_HTTP_URL: "http://openclaw.test",
      OPENCLAW_EXECUTE_PATH: "/tools/invoke",
      OPENCLAW_SKILLS_PATH: "/v1/skills",
      OPENCLAW_SKILLS_STATIC: undefined,
      OPENCLAW_GATEWAY_TOOLS_INVOKE: "1",
      OPENCLAW_GENERIC_TASK_TOOL: "web",
    }
  );
});
