# AGENTS.md — Front Desk Companion Chatbot

This file is for AI agents working on this codebase. Read it before touching anything.

## What This Is

A Next.js chatbot built on the Vercel AI template with two modes:

- **Owner mode** — personal companion that listens, remembers, sets reminders, and spots connections
- **Visitor mode** — business front desk that collects intake, answers questions, and escalates to a human

The owner is the authenticated user who created a business profile. Everyone else is a visitor.

## Project Structure

```
app/
  (auth)/              # Auth pages (login, register) — don't touch
  (chat)/
    api/chat/route.ts  # Main chat endpoint — dual-mode routing lives here
    api/escalations/   # Escalation management API
    api/reminders/     # QStash webhook for reminder delivery
  api/
    digest/            # Daily digest cron endpoint
    reminders/         # (same as above — check actual path)
lib/
  ai/
    companion-prompt.ts  # Owner-mode system prompt builder
    front-desk-prompt.ts # Visitor-mode system prompt builder
    prompts.ts           # Shared prompt utilities (artifacts, request hints)
    models.ts            # Model roster and capabilities
    providers.ts         # AI Gateway provider setup
    tools/               # All tools — one file per tool
      save-memory.ts     # Owner: save to Memory table
      recall-memory.ts   # Owner: FTS search over memories
      set-reminder.ts    # Owner: schedule via QStash
      record-intake.ts   # Visitor: save intake submission
      escalate-to-human.ts # Visitor: create escalation record
      summarize-opportunity.ts # Visitor: log opportunity
  db/
    schema.ts          # Drizzle schema — all tables defined here
    queries.ts         # All database queries — one file, grouped by domain
    migrations/        # SQL migration files (sequential numbering)
```

## Current Plan

See `docs/superpowers/plans/2026-03-28-companion-assistant.md` for the full implementation plan with task breakdown and dependency graph.

See `docs/superpowers/specs/2026-03-28-companion-assistant-design.md` for the design spec.

## Conventions

### Code Style

- TypeScript strict mode. The project uses `ultracite` (Biome-based) for formatting/linting.
- Run `pnpm check` before committing to catch lint issues.
- Run `pnpm fix` to auto-fix formatting.

### File Patterns

- **One tool per file** in `lib/ai/tools/`. Each exports a single function (or factory function if it needs context like userId).
- **All queries in one file** (`lib/db/queries.ts`), grouped by domain with comment headers.
- **Migrations are raw SQL**, numbered sequentially: `0000_initial.sql`, `0001_front_desk_tables.sql`, `0002_memory_table.sql`, etc.
- The Drizzle schema (`lib/db/schema.ts`) must stay in sync with migrations, but the `tsv` generated column is Postgres-only and NOT in the Drizzle schema.

### Commits

- Conventional commits: `feat:`, `fix:`, `docs:`, `refactor:`, `test:`
- One logical change per commit
- Build must pass before committing (`pnpm build`)

### Environment Variables

All env vars are documented in `.env.local` (template with comments) and `DEPLOY.md` (table with descriptions). When adding a new env var:
1. Add it to `.env.local` with a comment explaining where to get the value
2. Add it to the table in `DEPLOY.md`
3. Add setup instructions to `SETUP.md`

### Testing

- Playwright for E2E tests: `pnpm test`
- Models are mockable via `lib/ai/models.mock.ts` — the provider setup switches to mocks when `PLAYWRIGHT=True`
- For new tools: manual smoke test via `pnpm dev` is acceptable for v1; add Playwright coverage for critical paths

## Parallel Work Streams

The implementation plan has three phases. Here's how to parallelize safely.

### Phase 1: Foundation (two agents, zero overlap)

| Stream | Tasks | Files touched | Agent boundary |
|--------|-------|---------------|----------------|
| **A: Schema** | 1, 2, 3 | `lib/db/migrations/*`, `lib/db/schema.ts`, `lib/db/queries.ts` | Only touches `lib/db/` |
| **B: Prompt** | 4 | `lib/ai/companion-prompt.ts` (new file) | Only creates one new file in `lib/ai/` |

These have zero file overlap and can run simultaneously.

### Phase 2: Tools & Services (up to five agents, after Phase 1)

| Stream | Tasks | Files touched | Agent boundary |
|--------|-------|---------------|----------------|
| **C: saveMemory** | 5 | `lib/ai/tools/save-memory.ts` (new) | One new file |
| **D: recallMemory** | 6 | `lib/ai/tools/recall-memory.ts` (new) | One new file |
| **E: setReminder** | 7 | `lib/ai/tools/set-reminder.ts` (new), `package.json` | New file + dependency |
| **F: Webhook** | 8 | `app/api/reminders/route.ts` (new), `package.json` | New file + dependency |
| **G: Digest** | 9 | `app/api/digest/route.ts` (new), `vercel.json`, `.env.local` | New file + config |

**Conflict risk:** E and F both add packages. If running in parallel, coordinate `package.json` / lockfile changes — one agent should install both dependencies (`@upstash/qstash` and `resend`) before the other starts, or handle the merge conflict.

### Phase 3: Integration (one agent, sequential)

| Stream | Tasks | Files touched |
|--------|-------|---------------|
| **H: Wiring** | 10, 11 | `app/(chat)/api/chat/route.ts`, `.env.local`, `SETUP.md`, `DEPLOY.md` |

This must run after all Phase 2 tasks complete. It touches the chat route (the main integration point) and documentation.

## Review Checklist

When reviewing a PR or completed task, check these:

- [ ] `pnpm build` passes
- [ ] `pnpm check` passes (no lint errors)
- [ ] No hardcoded secrets or env values
- [ ] New env vars documented in `.env.local`, `SETUP.md`, and `DEPLOY.md`
- [ ] New tools follow the one-file-per-tool pattern in `lib/ai/tools/`
- [ ] New queries added to `lib/db/queries.ts` with proper error handling (ChatbotError)
- [ ] Schema changes have a corresponding migration file
- [ ] Commit messages follow conventional format
- [ ] The change doesn't break the other mode (owner changes don't break visitor, and vice versa)

## Key Decisions (don't revisit without good reason)

1. **Single Memory table** with a `kind` column, not separate tables per type. YAGNI.
2. **Postgres FTS** for recall, not a vector database. Free, fast enough at personal scale, zero new infra.
3. **QStash for reminders**, not Vercel Cron. Cron is daily-only on Hobby; QStash allows arbitrary scheduling.
4. **Resend for email**, not a custom SMTP setup. One API key, generous free tier, simple SDK.
5. **Owner detection** via `businessProfile.userId === session.user.id`, not a separate role system.
6. **Models routed through Vercel AI Gateway** to cheapest providers. The $5 monthly budget is token-only.
