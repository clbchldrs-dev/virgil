import { config } from "dotenv";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { user } from "./schema";
import { generateHashedPassword } from "./utils";

config({ path: ".env.local" });

/** Plaintext only for local/dev seeding; override with VIRGIL_SEED_DEMO_PASSWORD. */
const DEFAULT_DEMO_PLAINTEXT = "virgil-demo";

async function seed() {
  if (!process.env.POSTGRES_URL) {
    console.log("POSTGRES_URL not defined, skipping seed");
    process.exit(0);
  }

  const connection = postgres(process.env.POSTGRES_URL, { max: 1 });
  const db = drizzle(connection);

  console.log("Seeding demo data...");

  const demoEmail = "demo@virgil.local";
  const demoPlaintext =
    process.env.VIRGIL_SEED_DEMO_PASSWORD?.trim() || DEFAULT_DEMO_PLAINTEXT;
  const demoHash = generateHashedPassword(demoPlaintext);

  const [existing] = await db
    .select()
    .from(user)
    .where(eq(user.email, demoEmail))
    .limit(1);

  let wroteDemoPassword = false;

  if (existing) {
    if (existing.password) {
      console.log("Demo user already exists:", demoEmail);
    } else {
      await db
        .update(user)
        .set({ password: demoHash, updatedAt: new Date() })
        .where(eq(user.email, demoEmail));
      console.log(
        "Demo user existed without a password; set credential hash so sign-in works:",
        demoEmail
      );
      wroteDemoPassword = true;
    }
  } else {
    await db
      .insert(user)
      .values({
        email: demoEmail,
        password: demoHash,
        name: "Demo User",
      })
      .returning();
    console.log("Created demo user:", demoEmail);
    wroteDemoPassword = true;
  }

  if (wroteDemoPassword) {
    const usingDefault =
      !process.env.VIRGIL_SEED_DEMO_PASSWORD?.trim() ||
      process.env.VIRGIL_SEED_DEMO_PASSWORD.trim() === DEFAULT_DEMO_PLAINTEXT;
    if (usingDefault) {
      console.log(
        `Sign in: ${demoEmail} / ${DEFAULT_DEMO_PLAINTEXT} (dev only — set VIRGIL_SEED_DEMO_PASSWORD to change)`
      );
    } else {
      console.log(
        `Sign in: ${demoEmail} / (value of VIRGIL_SEED_DEMO_PASSWORD)`
      );
    }
  }

  console.log("Seed complete!");
  await connection.end();
  process.exit(0);
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
