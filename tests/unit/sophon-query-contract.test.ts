import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

test("sophon query module is wired into db query exports", async () => {
  const [queriesBarrel, sophonModule] = await Promise.all([
    readFile(new URL("../../lib/db/queries.ts", import.meta.url), "utf8"),
    readFile(
      new URL("../../lib/db/query-modules/sophon.ts", import.meta.url),
      "utf8"
    ),
  ]);

  assert.match(queriesBarrel, /export \* from "\.\/query-modules\/sophon";/);
  assert.match(sophonModule, /export async function listSophonTasksForUser/);
});
