/**
 * Terminal client for POST /api/memory/bridge (memory search + save without Postgres on the client).
 * Loads .env.local via dotenv (run from repo root).
 *
 * Usage:
 *   pnpm memory:bridge search "query text"
 *   pnpm memory:bridge save note "content to store"
 */

import { resolve } from "node:path";
import { config } from "dotenv";

config({ path: resolve(process.cwd(), ".env.local") });

const secret = process.env.VIRGIL_MEMORY_BRIDGE_SECRET?.trim();
const baseRaw =
  process.env.VIRGIL_MEMORY_BRIDGE_BASE_URL?.trim() ||
  process.env.NEXT_PUBLIC_APP_URL?.trim() ||
  "http://localhost:3000";
const base = baseRaw.replace(/\/$/, "");

async function main() {
  const argv = process.argv.slice(2);
  const [cmd, ...rest] = argv;

  if (!secret) {
    process.stderr.write(
      "VIRGIL_MEMORY_BRIDGE_SECRET is not set in .env.local\n"
    );
    process.exit(1);
  }

  if (cmd === "search") {
    const query = rest.join(" ").trim();
    if (!query) {
      process.stderr.write('Usage: pnpm memory:bridge search "your query"\n');
      process.exit(1);
    }
    const res = await fetch(`${base}/api/memory/bridge`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${secret}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ op: "search", query }),
    });
    const text = await res.text();
    if (!res.ok) {
      process.stderr.write(`${res.status}: ${text}\n`);
      process.exit(1);
    }
    process.stdout.write(`${text}\n`);
    return;
  }

  if (cmd === "save") {
    const kind = rest[0]?.trim();
    const content = rest.slice(1).join(" ").trim();
    if (
      !kind ||
      !["note", "fact", "goal", "opportunity"].includes(kind) ||
      !content
    ) {
      process.stderr.write(
        "Usage: pnpm memory:bridge save <note|fact|goal|opportunity> <content>\n"
      );
      process.exit(1);
    }
    const res = await fetch(`${base}/api/memory/bridge`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${secret}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        op: "save",
        kind,
        content,
      }),
    });
    const text = await res.text();
    if (!res.ok) {
      process.stderr.write(`${res.status}: ${text}\n`);
      process.exit(1);
    }
    process.stdout.write(`${text}\n`);
    return;
  }

  process.stderr.write(
    'Usage:\n  pnpm memory:bridge search "query"\n  pnpm memory:bridge save note "content"\n'
  );
  process.exit(1);
}

main().catch((err: unknown) => {
  const message = err instanceof Error ? err.message : String(err);
  process.stderr.write(`${message}\n`);
  process.exit(1);
});
