import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("delegateTask applies preflight gate before queueing intent", async () => {
  const source = await readFile(
    new URL("../../lib/ai/tools/delegate-to-openclaw.ts", import.meta.url),
    "utf8"
  );

  const preflightIdx = source.indexOf(
    "const preflight = evaluateDelegationPreflight"
  );
  const preflightFailIdx = source.indexOf(
    'error: "delegation_preflight_failed"'
  );
  const queueIdx = source.indexOf("const row = await queuePendingIntent");

  assert.ok(preflightIdx >= 0, "expected preflight evaluation");
  assert.ok(preflightFailIdx >= 0, "expected preflight failure payload");
  assert.ok(queueIdx >= 0, "expected queue call");
  assert.ok(
    preflightIdx < queueIdx && preflightFailIdx < queueIdx,
    "expected preflight failure branch before queueing"
  );
});
