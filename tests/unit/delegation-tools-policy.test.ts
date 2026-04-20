import assert from "node:assert/strict";
import test from "node:test";

function withEnv(
  patch: Record<string, string | undefined>,
  fn: () => void | Promise<void>
) {
  const prev: Record<string, string | undefined> = {};
  for (const key of Object.keys(patch)) {
    prev[key] = process.env[key];
    const v = patch[key];
    if (v === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = v;
    }
  }
  return Promise.resolve(fn()).finally(() => {
    for (const key of Object.keys(patch)) {
      const p = prev[key];
      if (p === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = p;
      }
    }
  });
}

test("isDelegationToolsPaused is false when unset", async () => {
  await withEnv({ VIRGIL_DELEGATION_TOOLS_DISABLED: undefined }, async () => {
    const { isDelegationToolsPaused } = await import(
      "../../lib/integrations/delegation-tools-policy"
    );
    assert.equal(isDelegationToolsPaused(), false);
  });
});

test("isDelegationToolsPaused is true for 1 true yes", async () => {
  for (const v of ["1", "true", "yes"]) {
    await withEnv({ VIRGIL_DELEGATION_TOOLS_DISABLED: v }, async () => {
      const { isDelegationToolsPaused } = await import(
        "../../lib/integrations/delegation-tools-policy"
      );
      assert.equal(
        isDelegationToolsPaused(),
        true,
        `expected paused for ${JSON.stringify(v)}`
      );
    });
  }
});

test("isDelegationChatToolsEnabled respects pause when OpenClaw configured", async () => {
  await withEnv(
    {
      HERMES_HTTP_URL: undefined,
      OPENCLAW_HTTP_URL: "http://127.0.0.1:13100",
      OPENCLAW_URL: undefined,
      VIRGIL_DELEGATION_TOOLS_DISABLED: "1",
    },
    async () => {
      const { isDelegationChatToolsEnabled } = await import(
        "../../lib/integrations/delegation-tools-policy"
      );
      assert.equal(isDelegationChatToolsEnabled(), false);
    }
  );
});

test("isDelegationChatToolsEnabled is true when configured and not paused", async () => {
  await withEnv(
    {
      HERMES_HTTP_URL: undefined,
      OPENCLAW_HTTP_URL: "http://127.0.0.1:13100",
      OPENCLAW_URL: undefined,
      VIRGIL_DELEGATION_TOOLS_DISABLED: undefined,
    },
    async () => {
      const { isDelegationChatToolsEnabled } = await import(
        "../../lib/integrations/delegation-tools-policy"
      );
      assert.equal(isDelegationChatToolsEnabled(), true);
    }
  );
});
