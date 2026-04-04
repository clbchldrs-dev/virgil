# v1 issues that inhibit v2 development

This document answers **what in shipped v1 makes a Python v2 backend and migration harder**, so work can be prioritized. It complements [V2_MIGRATION.md](V2_MIGRATION.md) and [E10 groundwork overview](tickets/2026-04-01-v2-groundwork-overview.md) (**T1–T8**).

## Critical (blocks clean handoff without reverse-engineering)

| Issue | Evidence | Why it hurts v2 |
|-------|----------|-------------------|
| **No published API / tool / memory contracts** | **T1:** [V2_API_CONTRACT.md](V2_API_CONTRACT.md). **T2:** [V2_TOOL_MAP.md](V2_TOOL_MAP.md). **T3–T4** (eval JSONL, memory blueprint) still pending until those tickets land. | Without T3–T4, a FastAPI service still risks drift on memory and telemetry; chat/tools have written baselines. |
| **Chat route is a single integration surface** | `app/(chat)/api/chat/route.ts` — auth, rate limits, `streamText`, tools, Mem0, optional planner, title gen, resumable streams. | No labeled seam for “replace this with HTTP to Python”; highest migration cost file. |
| **DB + tools are co-located in-process** | Many `app/**/api` routes and `lib/ai/tools` import `@/lib/db/queries` directly; Drizzle schema is Postgres-specific (`lib/db/schema.ts`). | v2 cannot swap the backend without mapping tables and tool side effects; ETL becomes bespoke. |

## High (significant rework or dual-run period)

| Issue | Evidence | Why it hurts v2 |
|-------|----------|-------------------|
| **Session/auth is NextAuth-centric** | `app/(auth)/auth.ts`, cookie-based sessions. | A headless Python API needs a **documented** trust model (JWT from Next, BFF proxy, shared secret)—not a stable v1 contract yet. |
| **Background jobs tied to Vercel + Upstash** | QStash webhooks, [`vercel.json`](../vercel.json) cron, Redis usage — see [security/tool-inventory.md](security/tool-inventory.md). | Digest, night review, reminders assume managed queue/cron; Mac mini v2 needs scheduler + HTTP (see [AGENTS.md](../AGENTS.md) self-hosted cron). |
| **v2-eval logging not fully wired** | [`lib/v2-eval/interaction-log.ts`](../lib/v2-eval/interaction-log.ts) defines `logInteraction`; call sites may be incomplete until **T3** lands. [workspace/v2-eval/README.md](../workspace/v2-eval/README.md) describes optional JSONL. | Stable JSONL for behavioral analysis may lag behind ideal. |

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
| **T3** | Wire / extend `logInteraction` and JSONL |
| **T4** | Memory migration blueprint |
| **T5–T8** | Night parity, traces, cost telemetry, persona SSOT |

## Suggested priority

1. Land **T1 + T2** before a Python backend spike.
2. Complete **T3** so `workspace/v2-eval/` reflects real traffic.
3. **T4** before writing ETL from Postgres → v2 store(s).
4. Treat **auth** and **background jobs** as explicit v2 design tasks.
