import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const unitDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(unitDir, "../..");
const routePath = join(repoRoot, "app/(chat)/api/sophon/daily/route.ts");
const routeSrc = readFileSync(routePath, "utf8");

test("sophon daily route source exports GET handler", () => {
  assert.match(routeSrc, /export async function GET\b/);
});

test("sophon daily route rejects guest sessions on GET and POST", () => {
  const guestGuards = routeSrc.match(
    /session\.user\.type === "guest"/g
  )?.length;
  assert.equal(guestGuards, 2);
});

test("sophon daily route exports GET as a function when loaded (react-server)", async () => {
  const { spawnSync } = await import("node:child_process");
  const env = { ...process.env };
  if (!env.VIRGIL_SOPHON_DAILY_ROUTE_CONTRACT_CHILD) {
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
        env: { ...env, VIRGIL_SOPHON_DAILY_ROUTE_CONTRACT_CHILD: "1" },
        stdio: ["ignore", "ignore", "pipe"],
      }
    );
    assert.equal(
      result.status,
      0,
      `expected GET from sophon daily route (typeof function); stderr: ${result.stderr}`
    );
    return;
  }

  const { GET } = await import("@/app/(chat)/api/sophon/daily/route");
  assert.equal(typeof GET, "function");
});
