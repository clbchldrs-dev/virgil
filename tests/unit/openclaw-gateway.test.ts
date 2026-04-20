import assert from "node:assert/strict";
import test from "node:test";

const KEYS = [
  "OPENCLAW_EXECUTE_PATH",
  "OPENCLAW_GATEWAY_TOOLS_INVOKE",
  "OPENCLAW_SINGLE_TOOL_MODE",
  "OPENCLAW_GENERIC_TASK_TOOL",
] as const;

function withEnv(
  overrides: Partial<Record<(typeof KEYS)[number], string | undefined>>,
  fn: () => void
) {
  const saved: Record<string, string | undefined> = {};
  for (const k of KEYS) {
    saved[k] = process.env[k];
  }
  for (const [k, v] of Object.entries(overrides)) {
    if (v === undefined) {
      Reflect.deleteProperty(process.env, k);
    } else {
      process.env[k] = v;
    }
  }
  try {
    fn();
  } finally {
    for (const k of KEYS) {
      if (saved[k] === undefined) {
        Reflect.deleteProperty(process.env, k);
      } else {
        process.env[k] = saved[k];
      }
    }
  }
}

import {
  buildOpenClawGatewayInvokeBody,
  openClawGatewayToolNameForIntent,
  openClawSingleToolModeEnabled,
} from "../../lib/integrations/openclaw-gateway";
import type { ClawIntent } from "../../lib/integrations/openclaw-types";

test("single-tool mode is off by default when using /tools/invoke", () => {
  withEnv(
    {
      OPENCLAW_EXECUTE_PATH: "/tools/invoke",
      OPENCLAW_GATEWAY_TOOLS_INVOKE: undefined,
      OPENCLAW_SINGLE_TOOL_MODE: undefined,
    },
    () => {
      assert.equal(openClawSingleToolModeEnabled(), false);
    }
  );
});

test("single-tool mode on when OPENCLAW_SINGLE_TOOL_MODE=1", () => {
  withEnv(
    {
      OPENCLAW_EXECUTE_PATH: "/tools/invoke",
      OPENCLAW_SINGLE_TOOL_MODE: "1",
    },
    () => {
      assert.equal(openClawSingleToolModeEnabled(), true);
    }
  );
});

test("gateway invoke body maps skill to tool when single-tool off", () => {
  withEnv(
    {
      OPENCLAW_EXECUTE_PATH: "/tools/invoke",
      OPENCLAW_SINGLE_TOOL_MODE: undefined,
    },
    () => {
      const intent: ClawIntent = {
        skill: "sessions_list",
        params: { description: "x" },
        priority: "normal",
        source: "chat",
        requiresConfirmation: false,
      };
      assert.equal(openClawGatewayToolNameForIntent(intent), "sessions_list");
      const body = JSON.parse(buildOpenClawGatewayInvokeBody(intent)) as {
        tool: string;
        args: Record<string, unknown>;
      };
      assert.equal(body.tool, "sessions_list");
      assert.equal(body.args.description, "x");
    }
  );
});
