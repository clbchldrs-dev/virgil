import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

test("sophon daily route exports GET and POST handlers", async () => {
  const routeSource = await readFile(
    new URL("../../app/(chat)/api/sophon/daily/route.ts", import.meta.url),
    "utf8"
  );

  assert.match(routeSource, /export async function GET\(\)/);
  assert.match(routeSource, /export async function POST\(request: Request\)/);
});
