# v1 issues that inhibit v2 development

This document answers **what in shipped v1 makes a Python v2 backend and migration harder**, so work can be prioritized. It complements [V2_MIGRATION.md](V2_MIGRATION.md) and [E10 groundwork overview](tickets/2026-04-01-v2-groundwork-overview.md) (**T1–T8**).

## Critical (blocks clean handoff without reverse-engineering)

| Issue | Evidence | Why it hurts v2 |
|-------|----------|-------------------|
| **No published memory migration contract** | **T1:** [V2_API_CONTRACT.md](V2_API_CONTRACT.md) and **T2:** [V2_TOOL_MAP.md](V2_TOOL_MAP.md) are landed; **T3:** interaction JSONL wiring is landed in `app/(chat)/api/chat/route.ts` + `lib/v2-eval/interaction-log.ts`. The remaining contract gap is **T4** (`V2_MEMORY_MIGRATION.md`). | Without a concrete memory blueprint, a FastAPI service still risks drift on data export, tier mapping, and migration sequencing. |
| **Chat route is a single integration surface** | `app/(chat)/api/chat/route.ts` — auth, rate limits, `streamText`, tools, Mem0, optional planner, title gen, resumable streams. | No labeled seam for “replace this with HTTP to Python”; highest migration cost file. |
| **DB + tools are co-located in-process** | Many `app/**/api` routes and `lib/ai/tools` import `@/lib/db/queries` directly; Drizzle schema is Postgres-specific (`lib/db/schema.ts`). | v2 cannot swap the backend without mapping tables and tool side effects; ETL becomes bespoke. |

## High (significant rework or dual-run period)

| Issue | Evidence | Why it hurts v2 |
|-------|----------|-------------------|
| **Session/auth is NextAuth-centric** | `app/(auth)/auth.ts`, cookie-based sessions. | A headless Python API needs a **documented** trust model (JWT from Next, BFF proxy, shared secret)—not a stable v1 contract yet. |
| **Background jobs tied to Vercel + Upstash** | QStash webhooks, [`vercel.json`](../vercel.json) cron, Redis usage — see [security/tool-inventory.md](security/tool-inventory.md). | Digest, night review, reminders assume managed queue/cron; Mac mini v2 needs scheduler + HTTP (see [AGENTS.md](../AGENTS.md) self-hosted cron). |
| **Trace and cost JSONL are not wired yet** | `workspace/v2-eval/README.md` still marks `traces.jsonl` / `costs.jsonl` as planned; **T6–T7** track these gaps. | v2 routing and budget calibration have weaker pre-migration evidence without trace/cost logs. |

## Medium (manageable but easy to underestimate)

| Issue | Evidence | Why it hurts v2 |
|-------|----------|-------------------|
| **Optional cloud memory** | Mem0, gateway models, Redis in [`lib/ai/mem0-client.ts`](../lib/ai/mem0-client.ts), rate limits. | v2 memory tiers must explicitly subsume or replace these paths. |
| **UIMessage / AI SDK coupling** | `streamText`, `ChatMessage`, tool `parts` in [`lib/types.ts`](../lib/types.ts) and chat route. | Frontend ↔ Python must agree on message JSON and streaming; versioning should be explicit (**T1**). |
| **Dual v2 Postgres vs SQLite narrative** | [V2_MIGRATION.md](V2_MIGRATION.md) and [PROJECT.md](PROJECT.md). | Risk of **two** migration scripts if not gated per environment. |

## Mitigations (E10)

| Ticket | Mitigation |
|--------|------------|
| **T1–T2** | Formal API contract + tool map |
| **T3** | Landed: `logInteraction` wiring + JSONL |
| **T4** | Memory migration blueprint |
| **T5–T8** | Night parity, traces, cost telemetry, persona SSOT |

## Suggested priority

1. Land **T4** (`V2_MEMORY_MIGRATION.md`) before writing ETL from Postgres → v2 store(s).
2. Land **T5** parity mapping to avoid re-implementing night/digest/triage behavior by memory.
3. Land **T6 + T7** so `workspace/v2-eval/` has trace/cost evidence, not only interaction metadata.
4. Treat **auth** and **background jobs** as explicit v2 design tasks.
