/**
 * Preflight for local Docker (`.env.docker`). Does not modify files except with `--ensure-auth`.
 * Usage: pnpm exec tsx scripts/virgil-preflight.ts [--strict] [--ensure-auth]
 */
import { randomBytes } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { config } from "dotenv";

const strict = process.argv.includes("--strict");
const ensureAuth = process.argv.includes("--ensure-auth");

const envPath = resolve(process.cwd(), ".env.docker");

config({ path: envPath });

type Row = { key: string; ok: boolean; note: string };

const rows: Row[] = [
  {
    key: "AUTH_SECRET",
    ok: Boolean(process.env.AUTH_SECRET?.trim()),
    note: "Required for Auth.js in the container. Launcher generates this if missing.",
  },
  {
    key: "OLLAMA_BASE_URL",
    ok: true,
    note: process.env.OLLAMA_BASE_URL
      ? `Set (${process.env.OLLAMA_BASE_URL}) — host Ollama expected.`
      : "Optional; .env.docker.example uses http://host.docker.internal:11434",
  },
  {
    key: "AI_GATEWAY_API_KEY",
    ok: true,
    note: process.env.AI_GATEWAY_API_KEY
      ? "Set (hosted / gateway models)."
      : "Not set — OK if you only use Ollama; required for hosted models.",
  },
];

if (ensureAuth) {
  let raw = "";
  try {
    raw = readFileSync(envPath, "utf8");
  } catch {
    console.error(
      "virgil-preflight: .env.docker not found; run launcher once or copy .env.docker.example\n"
    );
    process.exit(1);
  }
  if (!/^AUTH_SECRET=.+$/m.test(raw)) {
    const secret = randomBytes(32).toString("base64");
    let next = raw;
    if (/^AUTH_SECRET=/m.test(next)) {
      next = next.replace(/^AUTH_SECRET=.*$/m, `AUTH_SECRET=${secret}`);
    } else {
      next = `${next.trimEnd()}\nAUTH_SECRET=${secret}\n`;
    }
    writeFileSync(envPath, next, "utf8");
    console.log("virgil-preflight: wrote AUTH_SECRET to .env.docker\n");
  }
  config({ path: envPath, override: true });
}

console.log("\nVirgil Docker env check (.env.docker)\n");

let missingCritical = false;
for (const { key, ok, note } of rows) {
  const status = ok ? "✓" : "✗";
  console.log(`  ${status} ${key}`);
  console.log(`      ${note}`);
  if (!ok && key === "AUTH_SECRET") {
    missingCritical = true;
  }
}

console.log("\nSee packaging/README.md and AGENTS.md for full setup.\n");

if (strict && missingCritical) {
  console.error(
    "Strict mode: set AUTH_SECRET in .env.docker (or run the launcher).\n"
  );
  process.exit(1);
}

process.exit(0);
