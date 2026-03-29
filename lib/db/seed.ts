import { config } from "dotenv";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import {
  businessProfile,
  escalationRecord,
  intakeSubmission,
  priorityNote,
  user,
} from "./schema";

config({ path: ".env.local" });

const DEMO_SCENARIOS = [
  {
    businessName: "Sunny Side Salon",
    industry: "Hair Salon",
    hoursOfOperation: "Tue-Sat 9am-7pm, Sun 10am-4pm",
    services: [
      "Haircuts",
      "Color & highlights",
      "Blowouts",
      "Bridal styling",
      "Beard trims",
    ],
    tonePreference: "friendly" as const,
    neverPromise: [
      "Exact color match from photos",
      "Same-day appointments",
      "Refunds on services",
    ],
    escalationContactName: "Maria Chen",
    escalationContactEmail: "maria@sunnyside.example",
    escalationRules:
      "Escalate if customer is unhappy with a previous visit, mentions allergic reactions, or requests a refund.",
    priorityNotes:
      "Always ask if the customer has been here before. New customers should be offered a complimentary consultation. Remind customers of our cancellation policy: 24hr notice required.",
  },
  {
    businessName: "QuickFix HVAC",
    industry: "HVAC / Plumbing",
    hoursOfOperation: "Mon-Fri 7am-6pm, Sat 8am-2pm (Emergency: 24/7)",
    services: [
      "AC repair",
      "Furnace installation",
      "Duct cleaning",
      "Water heater replacement",
      "Emergency service",
    ],
    tonePreference: "professional" as const,
    neverPromise: [
      "Exact pricing without inspection",
      "Same-day non-emergency visits",
      "Warranty coverage for third-party equipment",
    ],
    escalationContactName: "Tom Rivera",
    escalationContactEmail: "tom@quickfixhvac.example",
    escalationRules:
      "Escalate immediately for: gas leak reports, flooding, no heat in winter, or customer mentions legal action. Mark all of these as high urgency.",
    priorityNotes:
      "Safety first — if a customer reports a gas smell, tell them to leave the building and call 911 before anything else. For estimates, always collect the home address, system age, and brand if known.",
  },
];

async function seed() {
  if (!process.env.POSTGRES_URL) {
    console.log("POSTGRES_URL not defined, skipping seed");
    process.exit(0);
  }

  const connection = postgres(process.env.POSTGRES_URL, { max: 1 });
  const db = drizzle(connection);

  console.log("Seeding demo data...");

  const demoEmail = "demo@frontdesk.local";
  let [demoUser] = await db
    .select()
    .from(user)
    .where(eq(user.email, demoEmail))
    .limit(1);

  if (!demoUser) {
    [demoUser] = await db
      .insert(user)
      .values({
        email: demoEmail,
        password: null,
        name: "Demo User",
      })
      .returning();
    console.log("Created demo user:", demoUser.email);
  }

  for (const scenario of DEMO_SCENARIOS) {
    const { priorityNotes: notes, ...profileData } = scenario;

    const [profile] = await db
      .insert(businessProfile)
      .values({ ...profileData, userId: demoUser.id })
      .returning();

    console.log(`Created business profile: ${profile.businessName}`);

    await db.insert(priorityNote).values({
      businessProfileId: profile.id,
      content: notes,
    });

    await db.insert(escalationRecord).values({
      businessProfileId: profile.id,
      customerName: "Sample Customer",
      summary:
        "Customer asked about pricing and the assistant could not provide an exact quote without an on-site inspection.",
      urgency: "low",
      status: "pending",
    });

    await db.insert(intakeSubmission).values({
      businessProfileId: profile.id,
      customerName: "Alex Johnson",
      customerEmail: "alex@example.com",
      need: "Interested in scheduling a consultation",
      urgency: "medium",
      channelPreference: "email",
    });
  }

  console.log("Seed complete!");
  await connection.end();
  process.exit(0);
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
