import { config } from "dotenv";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { user } from "./schema";

config({ path: ".env.local" });

async function seed() {
  if (!process.env.POSTGRES_URL) {
    console.log("POSTGRES_URL not defined, skipping seed");
    process.exit(0);
  }

  const connection = postgres(process.env.POSTGRES_URL, { max: 1 });
  const db = drizzle(connection);

  console.log("Seeding demo data...");

  const demoEmail = "demo@virgil.local";
  const [existing] = await db
    .select()
    .from(user)
    .where(eq(user.email, demoEmail))
    .limit(1);

  if (existing) {
    console.log("Demo user already exists:", demoEmail);
  } else {
    await db
      .insert(user)
      .values({
        email: demoEmail,
        password: null,
        name: "Demo User",
      })
      .returning();
    console.log("Created demo user:", demoEmail);
  }

  console.log("Seed complete!");
  await connection.end();
  process.exit(0);
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
