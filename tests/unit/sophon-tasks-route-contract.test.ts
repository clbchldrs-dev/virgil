import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

test("sophon tasks route exports POST handler", async () => {
  const routeSource = await readFile(
    new URL("../../app/(chat)/api/sophon/tasks/route.ts", import.meta.url),
    "utf8"
  );

  assert.match(routeSource, /export async function POST\(request: Request\)/);
});
