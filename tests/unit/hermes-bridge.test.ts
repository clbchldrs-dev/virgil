import assert from "node:assert/strict";
import test from "node:test";
import {
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
