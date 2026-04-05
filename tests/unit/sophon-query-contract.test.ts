import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const unitDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(unitDir, "../..");
const dbDir = join(repoRoot, "lib/db");
const queriesSrc = readFileSync(join(dbDir, "queries.ts"), "utf8");
const sophonModuleSrc = readFileSync(
  join(dbDir, "query-modules/sophon.ts"),
  "utf8"
);

test("sophon query module is re-exported from lib/db/queries barrel", () => {
  assert.match(queriesSrc, /export \* from ["']\.\/query-modules\/sophon["']/);
});

test("lib/db/queries exports listSophonTasksForUser as a function", async () => {
  const { spawnSync } = await import("node:child_process");
  const env = { ...process.env };
  if (!env.POSTGRES_URL?.trim()) {
    env.POSTGRES_URL =
      "postgresql://127.0.0.1:5432/virgil_sophon_contract_stub";
  }
  if (!env.VIRGIL_SOPHON_QUERY_CONTRACT_CHILD) {
    const result = spawnSync(
      process.execPath,
      [
        "--conditions=react-server",
        "--test",
        "--import",
        "tsx",
        fileURLToPath(import.meta.url),
      ],
      {
        cwd: repoRoot,
        encoding: "utf8",
        env: { ...env, VIRGIL_SOPHON_QUERY_CONTRACT_CHILD: "1" },
        stdio: ["ignore", "ignore", "pipe"],
      }
    );
    assert.equal(
      result.status,
      0,
      `expected listSophonTasksForUser from @/lib/db/queries (typeof function); stderr: ${result.stderr}`
    );
    return;
  }

  const mod = await import("@/lib/db/queries");
  assert.equal(typeof mod.listSophonTasksForUser, "function");
});

test("sophon query module defines upsertSophonDailyReviewForUser", () => {
  assert.match(
    sophonModuleSrc,
    /export async function upsertSophonDailyReviewForUser/
  );
});
