import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

test("openclaw pending PATCH route maps skipped reasons to explicit payloads", async () => {
  const routeSource = await readFile(
    new URL("../../app/(chat)/api/openclaw/pending/route.ts", import.meta.url),
    "utf8"
  );

  assert.match(routeSource, /buildPendingIntentApproveResponse/);
  assert.match(routeSource, /countDelegationBacklogForUser/);
});
