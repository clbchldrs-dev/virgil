import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("delegation health route exposes backend diagnostics", async () => {
  const routeSource = await readFile(
    new URL("../../app/(chat)/api/delegation/health/route.ts", import.meta.url),
    "utf8"
  );

  assert.match(routeSource, /export async function GET\(\)/);
  assert.match(routeSource, /backend:\s*provider\.backend/);
  assert.match(routeSource, /delegationOnline/);
  assert.match(routeSource, /skillsPreview/);
  assert.match(routeSource, /probes:\s*\{/);
});
