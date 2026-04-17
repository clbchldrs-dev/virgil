/**
 * Set or replace a user's password hash (bcrypt) in Postgres.
 * For local/dev recovery when there is no forgot-password UI.
 *
 * Usage: `pnpm db:set-password <email> <new-password>`
 * Requires POSTGRES_URL (e.g. from .env.local).
 */
import { existsSync } from "node:fs";
import { resolve } from "node:path";

import { config } from "dotenv";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { user } from "@/lib/db/schema";
import { generateHashedPassword } from "@/lib/db/utils";

function loadLocalEnv() {
  const env = resolve(process.cwd(), ".env");
  const envLocal = resolve(process.cwd(), ".env.local");
  if (existsSync(env)) {
    config({ path: env });
  }
  if (existsSync(envLocal)) {
    config({ path: envLocal });
  }
}

async function main() {
  loadLocalEnv();

  const [, , emailRaw, passwordRaw] = process.argv;
  const email = emailRaw?.trim().toLowerCase();
  const password = passwordRaw ?? "";

  if (!email || !password || password.length < 6) {
    process.stderr.write(
      "Usage: pnpm db:set-password <email> <new-password>\nPassword must be at least 6 characters.\n"
    );
    process.exit(1);
  }

  const url = process.env.POSTGRES_URL?.trim();
  if (!url) {
    process.stderr.write("POSTGRES_URL is required.\n");
    process.exit(1);
  }

  const connection = postgres(url, { max: 1 });
  const db = drizzle(connection);

  const [row] = await db
    .select({ id: user.id })
    .from(user)
    .where(eq(user.email, email))
    .limit(1);

  if (!row) {
    process.stderr.write(`No user found for email: ${email}\n`);
    await connection.end();
    process.exit(1);
  }

  const hash = generateHashedPassword(password);
  await db
    .update(user)
    .set({ password: hash, updatedAt: new Date() })
    .where(eq(user.email, email));

  await connection.end();
  process.stdout.write(`Updated password for ${email}\n`);
}

main().catch((err) => {
  process.stderr.write(`${err instanceof Error ? err.message : String(err)}\n`);
  process.exit(1);
});
