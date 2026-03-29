import "server-only";

import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

const url = process.env.POSTGRES_URL?.trim();
if (!url) {
  throw new Error(
    "POSTGRES_URL is not set. Add a Postgres connection string to .env.local, run pnpm db:migrate, and restart pnpm dev. See AGENTS.md (Setup checklist)."
  );
}

export const client = postgres(url);
export const db = drizzle(client);
