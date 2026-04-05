/**
 * Backfill `Memory.embedding` for rows where it is null (Ollama embeddings).
 * Usage: `pnpm db:backfill-embeddings` (requires `POSTGRES_URL` in env).
 */
import { existsSync } from "node:fs";
import { resolve } from "node:path";

async function loadLocalEnv() {
  try {
    const { config } = await import("dotenv");
    const env = resolve(process.cwd(), ".env");
    const envLocal = resolve(process.cwd(), ".env.local");
    if (existsSync(env)) {
      config({ path: env });
    }
    if (existsSync(envLocal)) {
      config({ path: envLocal });
    }
  } catch {
    /* use process.env only */
  }
}

const BATCH = 20;
const DELAY_MS = 75;

async function sleep(ms: number) {
  await new Promise<void>((r) => {
    setTimeout(r, ms);
  });
}

async function main() {
  await loadLocalEnv();
  if (!process.env.POSTGRES_URL?.trim()) {
    process.stderr.write("POSTGRES_URL is required.\n");
    process.exit(1);
  }

  const { embedAndStoreMemoryVector } = await import("@/lib/db/queries");
  const { client } = await import("@/lib/db/client");

  let total = 0;
  for (;;) {
    const rows = await client.unsafe<{ id: string; content: string }[]>(
      `SELECT "id", "content" FROM "Memory" WHERE "embedding" IS NULL ORDER BY "createdAt" ASC LIMIT ${BATCH}`
    );
    if (rows.length === 0) {
      break;
    }
    for (const row of rows) {
      try {
        await embedAndStoreMemoryVector(row.id, row.content);
        total += 1;
      } catch {
        /* skip row */
      }
      await sleep(DELAY_MS);
    }
  }

  process.stdout.write(
    `Backfill completed: ${total} memory row(s) processed.\n`
  );
  await client.end({ timeout: 5 });
}

main().catch((e) => {
  process.stderr.write(`${e instanceof Error ? e.message : String(e)}\n`);
  process.exit(1);
});
