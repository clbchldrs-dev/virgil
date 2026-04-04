# Companion Assistant — Implementation Plan

> **Historical note (2026-04):** Business/front-desk mode described in this plan was **removed** from the product. Treat owner/visitor dual-mode and front-desk sections as superseded; companion + personal path remains.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a personal companion layer to the front-desk Virgil experience — memory, reminders, daily digest — while keeping the visitor-facing front desk intact.

**Architecture:** Dual-mode routing (owner vs. visitor) at the chat API level. A single Memory table with Postgres FTS powers recall. QStash handles scheduled reminders. Resend + Vercel Cron deliver a daily digest email.

**Tech Stack:** Next.js 16, Vercel AI SDK 6, Drizzle ORM, Neon Postgres (FTS), Upstash QStash, Resend, Vercel Cron

**Spec:** `docs/superpowers/specs/2026-03-28-companion-assistant-design.md`

---

## Phase 1 — Foundation (parallelizable: A and B have zero file overlap)

### Task 1: Memory table migration

**Files:**
- Create: `lib/db/migrations/0002_memory_table.sql`
- Modify: `lib/db/migrations/meta/_journal.json`

- [ ] **Step 1: Write the migration SQL**

```sql
CREATE TABLE IF NOT EXISTS "Memory" (
  "id"        uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "userId"    uuid NOT NULL REFERENCES "User"("id"),
  "chatId"    uuid REFERENCES "Chat"("id"),
  "kind"      varchar NOT NULL DEFAULT 'note',
  "content"   text NOT NULL,
  "metadata"  jsonb NOT NULL DEFAULT '{}',
  "tsv"       tsvector GENERATED ALWAYS AS (to_tsvector('english', "content")) STORED,
  "createdAt" timestamp DEFAULT now() NOT NULL,
  "updatedAt" timestamp DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "Memory_tsv_idx" ON "Memory" USING GIN ("tsv");
CREATE INDEX IF NOT EXISTS "Memory_userId_kind_idx" ON "Memory" ("userId", "kind");
CREATE INDEX IF NOT EXISTS "Memory_userId_createdAt_idx" ON "Memory" ("userId", "createdAt" DESC);
```

- [ ] **Step 2: Update the migration journal**

Add an entry to `lib/db/migrations/meta/_journal.json`:

```json
{
  "idx": 2,
  "version": "7",
  "when": 1711990000000,
  "tag": "0002_memory_table",
  "breakpoints": true
}
```

- [ ] **Step 3: Run the migration locally**

Run: `pnpm db:migrate`
Expected: Migration applies without errors

- [ ] **Step 4: Verify the table exists**

Run: `pnpm db:studio` and check for the Memory table, or run a quick query:
```bash
echo "SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'Memory';" | psql "$POSTGRES_URL"
```
Expected: columns id, userId, chatId, kind, content, metadata, tsv, createdAt, updatedAt

- [ ] **Step 5: Commit**

```bash
git add lib/db/migrations/0002_memory_table.sql lib/db/migrations/meta/_journal.json
git commit -m "feat: add Memory table with FTS index"
```

---

### Task 2: Drizzle schema for Memory

**Files:**
- Modify: `lib/db/schema.ts`

- [ ] **Step 1: Add the Memory table definition**

Append after the `escalationRecord` table definition in `lib/db/schema.ts`:

```typescript
export const memory = pgTable("Memory", {
  id: uuid("id").primaryKey().notNull().defaultRandom(),
  userId: uuid("userId")
    .notNull()
    .references(() => user.id),
  chatId: uuid("chatId").references(() => chat.id),
  kind: varchar("kind", { enum: ["note", "fact", "goal", "opportunity"] })
    .notNull()
    .default("note"),
  content: text("content").notNull(),
  metadata: json("metadata").$type<Record<string, unknown>>().notNull().default({}),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
  updatedAt: timestamp("updatedAt").notNull().defaultNow(),
});

export type Memory = InferSelectModel<typeof memory>;
```

Note: The `tsv` column is a generated column managed by Postgres — it does NOT go in the Drizzle schema. Drizzle doesn't read or write it; FTS queries use raw SQL via `db.execute()`.

- [ ] **Step 2: Verify the app still compiles**

Run: `pnpm build`
Expected: Builds without errors (the schema change is additive)

- [ ] **Step 3: Commit**

```bash
git add lib/db/schema.ts
git commit -m "feat: add Memory table to Drizzle schema"
```

---

### Task 3: Memory query functions

**Files:**
- Modify: `lib/db/queries.ts`

- [ ] **Step 1: Add the import**

Add `memory` and `Memory` to the existing import from `./schema` in `lib/db/queries.ts`.

- [ ] **Step 2: Write saveMemory query**

```typescript
export async function saveMemoryRecord({
  userId,
  chatId,
  kind,
  content,
  metadata,
}: {
  userId: string;
  chatId?: string;
  kind: "note" | "fact" | "goal" | "opportunity";
  content: string;
  metadata?: Record<string, unknown>;
}) {
  try {
    const [created] = await db
      .insert(memory)
      .values({ userId, chatId, kind, content, metadata: metadata ?? {} })
      .returning();
    return created;
  } catch (_error) {
    throw new VirgilError("bad_request:database", "Failed to save memory");
  }
}
```

- [ ] **Step 3: Write searchMemories query (FTS)**

This uses raw SQL for the `tsv` column since Drizzle doesn't model generated tsvector columns:

```typescript
export async function searchMemories({
  userId,
  query,
  kind,
  limit = 10,
}: {
  userId: string;
  query: string;
  kind?: "note" | "fact" | "goal" | "opportunity";
  limit?: number;
}): Promise<Memory[]> {
  try {
    const sanitized = query.replace(/[^\w\s]/g, " ").trim();
    if (!sanitized) return [];

    const tsquery = sanitized.split(/\s+/).filter(Boolean).join(" & ");
    const kindClause = kind ? `AND "kind" = '${kind}'` : "";

    const result = await client.unsafe<Memory[]>(
      `SELECT "id", "userId", "chatId", "kind", "content", "metadata", "createdAt", "updatedAt"
       FROM "Memory"
       WHERE "userId" = $1 ${kindClause}
         AND "tsv" @@ to_tsquery('english', $2)
       ORDER BY ts_rank("tsv", to_tsquery('english', $2)) DESC
       LIMIT $3`,
      [userId, tsquery, limit]
    );
    return result;
  } catch (_error) {
    throw new VirgilError("bad_request:database", "Failed to search memories");
  }
}
```

Note: This uses the `client` (raw postgres.js) rather than Drizzle, since `client` is already in scope at the top of queries.ts. The `unsafe` method is needed for the dynamic kind clause; inputs are parameterized where possible.

- [ ] **Step 4: Write getRecentMemories query (for digest)**

```typescript
export async function getRecentMemories({
  userId,
  since,
  limit = 50,
}: {
  userId: string;
  since: Date;
  limit?: number;
}): Promise<Memory[]> {
  try {
    return await db
      .select()
      .from(memory)
      .where(and(eq(memory.userId, userId), gte(memory.createdAt, since)))
      .orderBy(desc(memory.createdAt))
      .limit(limit);
  } catch (_error) {
    throw new VirgilError(
      "bad_request:database",
      "Failed to get recent memories"
    );
  }
}
```

- [ ] **Step 5: Verify build**

Run: `pnpm build`
Expected: Builds without errors

- [ ] **Step 6: Commit**

```bash
git add lib/db/queries.ts
git commit -m "feat: add memory save, search (FTS), and recent queries"
```

---

### Task 4: Companion system prompt

**Files:**
- Create: `lib/ai/companion-prompt.ts`

This task runs in **parallel** with Tasks 1-3 — it has no dependency on the schema.

- [ ] **Step 1: Write the companion prompt builder**

```typescript
import type { Memory } from "@/lib/db/schema";
import type { RequestHints } from "./prompts";
import { getRequestPromptFromHints, artifactsPrompt } from "./prompts";

export function buildCompanionSystemPrompt({
  ownerName,
  memories,
  requestHints,
  supportsTools,
}: {
  ownerName: string | null;
  memories: Memory[];
  requestHints: RequestHints;
  supportsTools: boolean;
}): string {
  const parts: string[] = [];

  const name = ownerName ?? "there";
  parts.push(
    `You are a personal assistant and companion for ${name}. You are warm, direct, and genuinely helpful. You listen carefully, remember what matters, and follow up when it counts.`
  );

  parts.push(`Your core habits:
- When you learn something worth remembering (a preference, a goal, a decision, a fact about the user's life), use the saveMemory tool. Ask before saving unless the user explicitly said "remember this."
- Before answering questions that might relate to past conversations, use the recallMemory tool to check if you have relevant context.
- When you spot a connection between something the user said now and something from memory, mention it naturally.
- You can set reminders using the setReminder tool — the user will get an email when it fires.
- Be concise. Don't narrate your tool use. Just be helpful.`);

  if (memories.length > 0) {
    const memoryContext = memories
      .map((m) => `[${m.kind}] ${m.content}`)
      .join("\n");
    parts.push(`Recent context from memory:\n${memoryContext}`);
  }

  parts.push(getRequestPromptFromHints(requestHints));

  if (supportsTools) {
    parts.push(artifactsPrompt);
  }

  return parts.join("\n\n");
}
```

- [ ] **Step 2: Verify build**

Run: `pnpm build`
Expected: Builds without errors

- [ ] **Step 3: Commit**

```bash
git add lib/ai/companion-prompt.ts
git commit -m "feat: add companion system prompt builder"
```

---

## Phase 2 — Tools & Services (parallelizable: each task touches distinct files)

All Phase 2 tasks depend on Phase 1 completing. Tasks 5, 6, 7, and 8 can run in parallel.

### Task 5: saveMemory tool

**Files:**
- Create: `lib/ai/tools/save-memory.ts`

- [ ] **Step 1: Write the tool**

```typescript
import { tool } from "ai";
import { z } from "zod";
import { saveMemoryRecord } from "@/lib/db/queries";

export function saveMemory({ userId, chatId }: { userId: string; chatId: string }) {
  return tool({
    description:
      "Save something to memory. Use when the user says 'remember this', shares a preference, states a goal, makes a decision, or tells you a fact worth keeping. Ask before saving unless the user explicitly requests it.",
    inputSchema: z.object({
      kind: z
        .enum(["note", "fact", "goal", "opportunity"])
        .describe("What type of memory: note (general), fact (about the user), goal (something they want), opportunity (a connection you spotted)"),
      content: z
        .string()
        .describe("The memory content — a clear, standalone summary that will make sense when recalled later without conversation context"),
      metadata: z
        .record(z.unknown())
        .optional()
        .describe("Optional structured data (tags, related IDs, dates)"),
    }),
    execute: async (input) => {
      const record = await saveMemoryRecord({
        userId,
        chatId,
        kind: input.kind,
        content: input.content,
        metadata: input.metadata,
      });
      return {
        success: true,
        memoryId: record.id,
        message: `Saved to memory as ${input.kind}.`,
      };
    },
  });
}
```

- [ ] **Step 2: Verify build**

Run: `pnpm build`
Expected: Builds without errors

- [ ] **Step 3: Commit**

```bash
git add lib/ai/tools/save-memory.ts
git commit -m "feat: add saveMemory tool"
```

---

### Task 6: recallMemory tool

**Files:**
- Create: `lib/ai/tools/recall-memory.ts`

- [ ] **Step 1: Write the tool**

```typescript
import { tool } from "ai";
import { z } from "zod";
import { searchMemories } from "@/lib/db/queries";

export function recallMemory({ userId }: { userId: string }) {
  return tool({
    description:
      "Search your memory for relevant past context. Use BEFORE answering questions that might relate to previous conversations — goals, preferences, past decisions, facts the user shared. Also use when you hear something that might connect to an earlier topic.",
    inputSchema: z.object({
      query: z
        .string()
        .describe("Keywords or phrases to search for in memory"),
      kind: z
        .enum(["note", "fact", "goal", "opportunity"])
        .optional()
        .describe("Filter by memory type"),
    }),
    execute: async (input) => {
      const results = await searchMemories({
        userId,
        query: input.query,
        kind: input.kind,
        limit: 8,
      });

      if (results.length === 0) {
        return { found: false, message: "No relevant memories found." };
      }

      return {
        found: true,
        count: results.length,
        memories: results.map((m) => ({
          kind: m.kind,
          content: m.content,
          savedAt: m.createdAt.toISOString(),
        })),
      };
    },
  });
}
```

- [ ] **Step 2: Verify build**

Run: `pnpm build`
Expected: Builds without errors

- [ ] **Step 3: Commit**

```bash
git add lib/ai/tools/recall-memory.ts
git commit -m "feat: add recallMemory tool"
```

---

### Task 7: setReminder tool

**Files:**
- Create: `lib/ai/tools/set-reminder.ts`

Requires `QSTASH_TOKEN` to be set. Install the QStash SDK first:

- [ ] **Step 1: Install @upstash/qstash**

Run: `pnpm add @upstash/qstash`

- [ ] **Step 2: Write the tool**

```typescript
import { tool } from "ai";
import { z } from "zod";
import { Client } from "@upstash/qstash";

const qstash = new Client({ token: process.env.QSTASH_TOKEN! });

function getBaseUrl(): string {
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
}

export function setReminder({
  userId,
  chatId,
}: {
  userId: string;
  chatId: string;
}) {
  return tool({
    description:
      "Set a reminder for the user. They will receive an email when it fires. Use when the user says 'remind me', 'don't let me forget', or describes something time-sensitive they want to follow up on.",
    inputSchema: z.object({
      message: z
        .string()
        .describe("The reminder message — what should the user be reminded about"),
      deliverAt: z
        .string()
        .describe("ISO 8601 timestamp for when to deliver the reminder (e.g. '2026-04-01T09:00:00Z')"),
    }),
    execute: async (input) => {
      const deliverTime = new Date(input.deliverAt);
      const now = new Date();
      if (deliverTime <= now) {
        return { success: false, message: "Reminder time must be in the future." };
      }

      const delaySeconds = Math.floor((deliverTime.getTime() - now.getTime()) / 1000);

      await qstash.publishJSON({
        url: `${getBaseUrl()}/api/reminders`,
        body: {
          userId,
          chatId,
          message: input.message,
          scheduledFor: input.deliverAt,
        },
        delay: delaySeconds,
      });

      return {
        success: true,
        message: `Reminder set for ${deliverTime.toLocaleString()}. You'll get an email.`,
        deliverAt: input.deliverAt,
      };
    },
  });
}
```

- [ ] **Step 3: Verify build**

Run: `pnpm build`
Expected: Builds without errors

- [ ] **Step 4: Commit**

```bash
git add lib/ai/tools/set-reminder.ts package.json pnpm-lock.yaml
git commit -m "feat: add setReminder tool using QStash"
```

---

### Task 8: Reminders webhook endpoint

**Files:**
- Create: `app/api/reminders/route.ts`

- [ ] **Step 1: Install resend**

Run: `pnpm add resend`

- [ ] **Step 2: Write the webhook handler**

```typescript
import { Receiver } from "@upstash/qstash";
import { Resend } from "resend";
import { saveMemoryRecord } from "@/lib/db/queries";
import { getUser } from "@/lib/db/queries";

const receiver = new Receiver({
  currentSigningKey: process.env.QSTASH_CURRENT_SIGNING_KEY!,
  nextSigningKey: process.env.QSTASH_NEXT_SIGNING_KEY!,
});

const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST(request: Request) {
  const body = await request.text();
  const signature = request.headers.get("upstash-signature");

  if (!signature) {
    return new Response("Missing signature", { status: 401 });
  }

  const isValid = await receiver.verify({ body, signature }).catch(() => false);
  if (!isValid) {
    return new Response("Invalid signature", { status: 401 });
  }

  const payload = JSON.parse(body) as {
    userId: string;
    chatId: string;
    message: string;
    scheduledFor: string;
  };

  const users = await getUser(payload.userId).catch(() => []);
  const userEmail = users[0]?.email;

  if (userEmail && !userEmail.startsWith("guest-")) {
    await resend.emails.send({
      from: "Assistant <onboarding@resend.dev>",
      to: userEmail,
      subject: `Reminder: ${payload.message.slice(0, 60)}`,
      text: `Hey — you asked me to remind you:\n\n${payload.message}\n\n(Originally scheduled for ${payload.scheduledFor})`,
    });
  }

  await saveMemoryRecord({
    userId: payload.userId,
    chatId: payload.chatId,
    kind: "note",
    content: `Reminder delivered: ${payload.message}`,
    metadata: { type: "reminder-delivered", scheduledFor: payload.scheduledFor },
  });

  return new Response("OK", { status: 200 });
}
```

Note: `getUser` in queries.ts currently searches by email, not ID. This handler needs to look up user by ID. Either add a `getUserById` query or use the existing `user` table directly. The simplest fix: add a `getUserById` function (3 lines) to queries.ts. The agent implementing this task should add it if missing.

- [ ] **Step 3: Verify build**

Run: `pnpm build`
Expected: Builds without errors

- [ ] **Step 4: Commit**

```bash
git add app/api/reminders/route.ts package.json pnpm-lock.yaml
git commit -m "feat: add /api/reminders QStash webhook with Resend email"
```

---

### Task 9: Daily digest endpoint

**Files:**
- Create: `app/api/digest/route.ts`

- [ ] **Step 1: Write the digest handler**

```typescript
import { Resend } from "resend";
import {
  getRecentMemories,
  getBusinessProfileByUserId,
} from "@/lib/db/queries";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { user } from "@/lib/db/schema";
import { isNotNull } from "drizzle-orm";

const resend = new Resend(process.env.RESEND_API_KEY);
const client = postgres(process.env.POSTGRES_URL ?? "");
const db = drizzle(client);

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  const owners = await db
    .select()
    .from(user)
    .where(isNotNull(user.password));

  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);

  for (const owner of owners) {
    if (owner.email.startsWith("guest-")) continue;

    const memories = await getRecentMemories({
      userId: owner.id,
      since,
      limit: 20,
    });

    if (memories.length === 0) continue;

    const grouped = {
      notes: memories.filter((m) => m.kind === "note"),
      facts: memories.filter((m) => m.kind === "fact"),
      goals: memories.filter((m) => m.kind === "goal"),
      opportunities: memories.filter((m) => m.kind === "opportunity"),
    };

    const sections: string[] = [];

    if (grouped.goals.length > 0) {
      sections.push(
        "Goals:\n" + grouped.goals.map((m) => `  - ${m.content}`).join("\n")
      );
    }
    if (grouped.opportunities.length > 0) {
      sections.push(
        "Opportunities:\n" +
          grouped.opportunities.map((m) => `  - ${m.content}`).join("\n")
      );
    }
    if (grouped.notes.length > 0) {
      sections.push(
        "Notes:\n" + grouped.notes.map((m) => `  - ${m.content}`).join("\n")
      );
    }
    if (grouped.facts.length > 0) {
      sections.push(
        "Things I learned about you:\n" +
          grouped.facts.map((m) => `  - ${m.content}`).join("\n")
      );
    }

    const body = `Here's what we covered in the last 24 hours:\n\n${sections.join("\n\n")}\n\nHave a good day.`;

    await resend.emails.send({
      from: "Assistant <onboarding@resend.dev>",
      to: owner.email,
      subject: `Your daily digest — ${new Date().toLocaleDateString()}`,
      text: body,
    });
  }

  return new Response("OK", { status: 200 });
}
```

- [ ] **Step 2: Add CRON_SECRET to .env.local template**

Add to `.env.local`:
```
# 6) Cron endpoint auth (any random string, must match Vercel Cron config)
CRON_SECRET=
```

- [ ] **Step 3: Configure Vercel Cron in vercel.json**

Update `vercel.json`:
```json
{
  "framework": "nextjs",
  "crons": [
    {
      "path": "/api/digest",
      "schedule": "0 8 * * *"
    }
  ]
}
```

- [ ] **Step 4: Verify build**

Run: `pnpm build`
Expected: Builds without errors

- [ ] **Step 5: Commit**

```bash
git add app/api/digest/route.ts vercel.json .env.local
git commit -m "feat: add daily digest endpoint with Vercel Cron"
```

---

## Phase 3 — Integration (sequential, after Phase 2)

### Task 10: Wire dual-mode routing in chat API

**Files:**
- Modify: `app/(chat)/api/chat/route.ts`

This is the keystone task — it connects everything. The existing route already loads the business profile and chooses between front-desk and default prompts. We extend it to add a third mode: companion.

- [ ] **Step 1: Add imports for companion tools and prompt**

Add to the imports in `route.ts`:
```typescript
import { buildCompanionSystemPrompt } from "@/lib/ai/companion-prompt";
import { saveMemory } from "@/lib/ai/tools/save-memory";
import { recallMemory } from "@/lib/ai/tools/recall-memory";
import { setReminder } from "@/lib/ai/tools/set-reminder";
import { getRecentMemories } from "@/lib/db/queries";
```

- [ ] **Step 2: Detect owner vs visitor**

After the existing `businessProfile` and `priorityNotes` fetches (around line 198-205), add owner detection:

```typescript
const isOwner = businessProfile && businessProfile.userId === session.user.id;
```

- [ ] **Step 3: Load memory context for owner**

For owner mode, load recent memories to seed the system prompt:

```typescript
const recentMemories = isOwner
  ? await getRecentMemories({ userId: session.user.id, since: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), limit: 15 })
  : [];
```

- [ ] **Step 4: Build the right system prompt**

Replace the existing `frontDeskSystemPrompt` block with three-way routing:

```typescript
const systemPromptText = isOwner
  ? buildCompanionSystemPrompt({
      ownerName: session.user.name ?? session.user.email?.split("@")[0] ?? null,
      memories: recentMemories,
      requestHints,
      supportsTools,
    })
  : businessProfile
    ? buildFrontDeskSystemPrompt({
        profile: businessProfile,
        priorityNotes,
        requestHints,
        supportsTools,
      })
    : buildDefaultSystemPrompt({ requestHints, supportsTools });
```

- [ ] **Step 5: Wire companion tools into streamText**

Extend the `streamText` call. When `isOwner`, add companion tools alongside base tools:

```typescript
const companionTools = {
  saveMemory: saveMemory({ userId: session.user.id, chatId: id }),
  recallMemory: recallMemory({ userId: session.user.id }),
  setReminder: setReminder({ userId: session.user.id, chatId: id }),
};

const companionToolNames = ["saveMemory", "recallMemory", "setReminder"] as const;
```

Then in the streamText branching, add an `isOwner` path that combines base tools + companion tools (instead of base + front-desk tools).

- [ ] **Step 6: Verify build and manual smoke test**

Run: `pnpm build`
Expected: Builds without errors

Run: `pnpm dev`
- Log in as the owner → chat should use companion prompt + memory tools
- Open an incognito window → guest should see front-desk prompt + intake tools

- [ ] **Step 7: Commit**

```bash
git add app/(chat)/api/chat/route.ts
git commit -m "feat: wire dual-mode routing — companion for owner, front desk for visitors"
```

---

### Task 11: Update env template and setup docs

**Files:**
- Modify: `.env.local`
- Modify: `AGENTS.md` (Setup checklist / Deployment)
- Modify: thin `SETUP.md` / `DEPLOY.md` link hubs if discoverability text changes

- [ ] **Step 1: Update .env.local with all new variables**

Add sections for QStash and Resend (below the existing AI Gateway section).

- [ ] **Step 2: Update AGENTS.md Setup checklist with new credential steps**

Add sections 1.6 (QStash), 1.7 (Resend), and 1.8 (CRON_SECRET).

- [ ] **Step 3: Update AGENTS.md Deployment env var table**

Add the four new env vars to the table.

- [ ] **Step 4: Commit**

```bash
git add .env.local AGENTS.md SETUP.md DEPLOY.md
git commit -m "docs: add QStash, Resend, and CRON_SECRET setup instructions"
```

---

## Dependency Graph

```
Phase 1 (parallel):
  Task 1 (migration) → Task 2 (schema) → Task 3 (queries)  }  Stream A
  Task 4 (companion prompt)                                   }  Stream B

Phase 2 (parallel, after Stream A completes):
  Task 5 (saveMemory tool)      }
  Task 6 (recallMemory tool)    }  can all run in parallel
  Task 7 (setReminder tool)     }
  Task 8 (reminders webhook)    }
  Task 9 (digest endpoint)      }

Phase 3 (sequential, after Phase 2):
  Task 10 (chat route wiring)
  Task 11 (docs update)
```

---

## Future / product backlog (outside this plan)

- **OpenClaw & community ideas (E6 in `AGENTS.md`):** Explore how to collect feature and workflow ideas from people using [OpenClaw](https://github.com/openclaw/openclaw) (and similar channels), then synthesize the most helpful or agentic patterns into Virgil’s roadmap — privacy, consent, and product fit TBD.
