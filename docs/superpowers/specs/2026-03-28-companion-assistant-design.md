# Companion Assistant — Design Spec

## Problem

Virgil currently serves one role: a business front desk that greets visitors, collects intake, and escalates to a human. The owner has no reason to use it themselves.

We want the bot to also be a **personal companion** for the owner — something that listens, remembers, assists, follows up, and spots connections. The visitor-facing front desk stays intact.

## Constraints

- **Budget:** $5/month total, spent entirely on AI Gateway tokens
- **Infrastructure:** all free tiers — Neon Postgres, Upstash Redis, Upstash QStash, Vercel Blob, Vercel Cron, Resend
- **Hackable:** easy to add new tools, modify behavior, experiment with prompts
- **Agentic:** each capability maps to a discrete tool with a clear schema

## Core Skills

### 1. Listen

The bot remembers what you've told it across conversations. When you come back tomorrow, it doesn't start from scratch.

**Mechanism:** A `Memory` table in Postgres with full-text search. The bot has a `recallMemory` tool it calls during conversations to pull in relevant past context. Memories are typed (`note`, `fact`, `goal`, `opportunity`) and timestamped.

**What gets saved:** The bot uses a `saveMemory` tool when it detects something worth remembering — a preference, a goal, a decision, a fact about your life. It also saves explicitly when you say "remember this." The bot should ask before saving implicitly until the user builds trust in the behavior.

### 2. Assist

General-purpose helpfulness. Already works via the AI Gateway model roster (DeepSeek V3.2, Kimi K2, Mistral Small, etc.). Vision is available through Mistral Small for images/screenshots. File uploads go to Vercel Blob.

No new infrastructure needed. The companion system prompt should make the bot aware of its full capabilities so it can offer them proactively.

### 3. Keep Notes & Provide Opportunities

Notes are stored via the memory system. Opportunities are what happens when the bot connects dots — "you mentioned X last week and Y today, those are related."

**Mechanism:** The companion prompt instructs the bot to proactively call `recallMemory` when it hears something that might relate to an earlier conversation. The LLM is the semantic engine; Postgres FTS narrows the candidate set.

Opportunities surface naturally in conversation. When the bot spots a connection, it mentions it. If it's significant, it saves an `opportunity`-typed memory.

### 4. Follow Up (Reminders)

The bot can follow up later. "Remind me to call the contractor Thursday" schedules a QStash message that hits `/api/reminders` at the specified time, which sends an email via Resend.

### 5. Daily Digest

A Vercel Cron job triggers `/api/digest` once per day. The endpoint loads recent memories, pending reminders, and spotted opportunities, then emails a brief summary via Resend. This is what makes the bot feel alive outside the chat window.

## Architecture

### Dual-Mode Routing

The chat API route determines the mode:

- **Owner mode:** authenticated user who has a business profile. Gets the companion system prompt + personal tools (saveMemory, recallMemory, setReminder) + the existing base tools.
- **Visitor mode:** anonymous/guest user. Gets the front-desk system prompt + intake tools (recordIntake, escalateToHuman, summarizeOpportunity) + the existing base tools.

Detection uses the existing `isAnonymous` flag on the User table plus the presence of a business profile.

### Memory System

One table, one FTS index, simple queries:

```sql
CREATE TABLE "Memory" (
  "id"        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "userId"    UUID NOT NULL REFERENCES "User"("id"),
  "chatId"    UUID REFERENCES "Chat"("id"),
  "kind"      VARCHAR NOT NULL DEFAULT 'note',  -- note | fact | goal | opportunity
  "content"   TEXT NOT NULL,
  "metadata"  JSONB DEFAULT '{}',
  "tsv"       TSVECTOR GENERATED ALWAYS AS (to_tsvector('english', "content")) STORED,
  "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMP NOT NULL DEFAULT now()
);

CREATE INDEX "Memory_tsv_idx" ON "Memory" USING GIN ("tsv");
CREATE INDEX "Memory_userId_kind_idx" ON "Memory" ("userId", "kind");
CREATE INDEX "Memory_userId_createdAt_idx" ON "Memory" ("userId", "createdAt" DESC);
```

`kind` is a simple enum — no separate tables. The `metadata` JSONB field holds tool-specific extras (reminder time, related memory IDs, tags) without schema changes.

### Reminder System

- **Tool:** `setReminder` — validates the input, calculates the delivery timestamp, publishes a QStash message targeting `/api/reminders`
- **Webhook:** `/api/reminders` — receives the QStash callback, loads the reminder details, sends an email via Resend, saves a memory noting the reminder was delivered
- **Verification:** QStash signing keys verify webhook authenticity

### Digest System

- **Cron:** Vercel Cron triggers `/api/digest` daily (configurable time via Edge Config or env var)
- **Logic:** Load memories from the last 24h, pending reminders for today, any `opportunity`-typed memories from the last week. Format into a brief email. Send via Resend.
- **Graceful:** If there's nothing to report, skip the email. No spam.

### New Tools Summary

| Tool | Mode | Description |
|------|------|-------------|
| `saveMemory` | Owner | Save a note, fact, goal, or opportunity to the Memory table |
| `recallMemory` | Owner | Search memories via FTS, return top results for context |
| `setReminder` | Owner | Schedule a future reminder via QStash |

### Environment Variables

| Variable | Source | New? |
|----------|--------|------|
| `AUTH_SECRET` | openssl | No |
| `POSTGRES_URL` | Neon | No |
| `REDIS_URL` | Upstash Redis | No |
| `BLOB_READ_WRITE_TOKEN` | Vercel Blob | No |
| `AI_GATEWAY_API_KEY` | Vercel AI Gateway | No |
| `QSTASH_TOKEN` | Upstash QStash | **Yes** |
| `QSTASH_CURRENT_SIGNING_KEY` | Upstash QStash | **Yes** |
| `QSTASH_NEXT_SIGNING_KEY` | Upstash QStash | **Yes** |
| `RESEND_API_KEY` | Resend | **Yes** |

### Free-Tier Limits

| Service | Limit | Expected usage |
|---------|-------|----------------|
| Neon Postgres | 512 MB, 190 compute-hrs/mo | Well under — personal-scale data |
| Upstash Redis | 10K commands/day | Rate limiting only — low hundreds/day |
| Upstash QStash | 500 messages/day | Reminders — single digits/day |
| Vercel Blob | 1 GB | File uploads — low usage |
| Vercel Cron | 2 jobs | 1 for digest, 1 spare |
| Resend | 100 emails/day | Digest + reminders — under 10/day |
| AI Gateway | ~$5 token budget | 100-200+ messages/day with cheap models |

## What This Does NOT Include

- Voice input/output (requires audio models, not free)
- Image generation (expensive)
- Third-party integrations (calendar, Slack, etc.) — future extension
- Multi-user companion mode (one owner per deployment)
- RAG over uploaded documents (possible future, but FTS over memory is v1)

## Success Criteria

1. Owner can chat with the bot and it remembers things across sessions
2. Owner can say "remember this" and the bot saves it
3. Bot proactively recalls relevant memories during conversation
4. Owner can set reminders and receive email notifications
5. Owner receives a daily digest email when there's something to report
6. Visitors still get the front-desk experience unchanged
7. Total infrastructure cost: $0 (tokens from $5 AI Gateway budget)
