import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";

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
    console.warn("dotenv unavailable; using process.env only");
  }
}

const runMigrate = async () => {
  await loadLocalEnv();

  if (!process.env.POSTGRES_URL?.trim()) {
    console.error(
      "POSTGRES_URL is not set. Add it to .env.local (copy from .env.example), then run pnpm db:migrate again. See AGENTS.md (Setup checklist)."
    );
    process.exit(1);
  }

  const connection = postgres(process.env.POSTGRES_URL.trim(), { max: 1 });
  const db = drizzle(connection);

  console.log("Running migrations...");

  const start = Date.now();
  await migrate(db, { migrationsFolder: "./lib/db/migrations" });
  const end = Date.now();

  console.log("Migrations completed in", end - start, "ms");
  process.exit(0);
};

runMigrate().catch((err) => {
  console.error("Migration failed");
  console.error(err);
  process.exit(1);
});
