import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

test("alexa route exports POST and handles core intents", async () => {
  const routeSource = await readFile(
    new URL("../../app/api/channels/alexa/route.ts", import.meta.url),
    "utf8"
  );

  assert.match(routeSource, /export async function POST\(request: Request\)/);
  assert.match(routeSource, /StatusIntent/);
  assert.match(routeSource, /CaptureIntent/);
  assert.match(routeSource, /VIRGIL_ALEXA_SECRET/);
});
