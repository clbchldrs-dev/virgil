# Virgil v1 → v2 Migration Path

## What carries forward from v1

- **Chat UI and auth system** — The Next.js frontend becomes the UI layer for v2's Python backend.
- **Personality work** — v1 voice SSOT is [`docs/VIRGIL_PERSONA.md`](VIRGIL_PERSONA.md); TypeScript builders implement it (`lib/ai/companion-prompt.ts`, `lib/ai/slim-prompt.ts`, `lib/ai/goal-guidance-prompt.ts`). Port to v2's `persona.md` from that file, not only from raw prompt strings.
- **Tool architecture** — `lib/ai/tools/` (one tool per file) maps to v2's `tools/` directory pattern.
- **Agent task pipeline** — `lib/agent-tasks/` is the conceptual ancestor of v2's night mode.
- **Docker Compose setup** — Adaptable for v2's Python services.
- **AGENTS.md handoff pattern** — Adopted directly in v2.

## What gets replaced

- **Inference layer** — v1 Ollama/gateway mix → v2 Python backend on Mac Mini M4 Pro with local-first Ollama (14B/32B) + Gemini API escalation. Phase 2: tiiny.ai Pocket Lab for heavy local tier (70B+).
- **Database** — v1’s **Neon/server Postgres + Drizzle** (see [docs/PROJECT.md](PROJECT.md)) → see **Data layer options** below (not a single mandated store).
- **Backend runtime** — Next.js API routes → Python FastAPI (headless).
- **Memory** — Redis + Postgres → v2’s tiered design (see blueprint in E10 **T4** / future `V2_MEMORY_MIGRATION.md`); greenfield often described as SQLite/Mem0 with priority weighting.

## Data layer options (v2)

Two tracks are valid; pick one per environment and document it.

- **Greenfield v2 (lean blueprint):** **SQLite + Mem0** as in the original migration summary—minimal server dependency, matches many samples in [docs/V2_ARCHITECTURE.md](V2_ARCHITECTURE.md). Implementation may target SQLite **first** in Python while the UI remains Next.js.
- **Migration-first (parity with v1):** Run **Postgres on the Mac mini or LAN** (Docker or native) so Drizzle/schema and relational data can move with **less** ETL shock; optional later consolidation to SQLite if you still want the lean footprint.

Do **not** assume every deployment uses only one of these forever: the risk is maintaining **two** parallel migration scripts—gate by explicit operator choice (see [docs/V1_V2_RISK_AUDIT.md](V1_V2_RISK_AUDIT.md)).

## Behavioral and goal state (v1 pivot vs v2 store)

v1 may add structured goals via the **proactive pivot** track ([docs/tickets/2026-04-02-pivot-goals-layer-design.md](tickets/2026-04-02-pivot-goals-layer-design.md)) on top of **`GoalWeeklySnapshot`** and `Memory` — optimized for the Neon/Drizzle app.

v2’s **authoritative behavioral store** for habits, streaks, project graph, and weekly schedule is specified in **[docs/V2_BEHAVIORAL_SPECS.md](V2_BEHAVIORAL_SPECS.md)** (SQLite-first on the Mac Mini, richer relations: `goal_entries`, `goal_dependencies`, `project_actions`, etc.). It is **not** required to duplicate that full schema in v1.

**Avoid two sources of truth:** Until a bridge is defined, treat v2 behavioral tables as the system of record after cutover, or use explicit read-only sync from one side. Do not maintain parallel “goal intent” in both Neon and SQLite without an ADR.

## What's new in v2

- Tool execution (Virgil can act, not just advise)
- Night mode (autonomous work window while Caleb sleeps)
- Skills/plugin system (modular capabilities without core changes)
- API cost tracking and budget management
- Self-evaluation and memory consolidation
- Split frontend (Vercel) / backend (local hardware) architecture

## Pre-migration data collection (active now)

See `workspace/v2-eval/README.md` for what v1 is collecting to inform v2 development. Known v1 friction points for v2 are listed in [docs/V1_V2_RISK_AUDIT.md](V1_V2_RISK_AUDIT.md).

**Execution plan:** [docs/tickets/2026-04-01-v2-groundwork-overview.md](tickets/2026-04-01-v2-groundwork-overview.md) — two-sprint ticket set (API contract, tool map, chat instrumentation, memory blueprint, night parity, traces, cost telemetry, persona SSOT).

## Migration steps (execute in June 2026)

1. Stand up Python backend on Mac Mini M4 Pro (Ollama + Python 3.11+)
2. Port persona from [`docs/VIRGIL_PERSONA.md`](VIRGIL_PERSONA.md) → v2 `persona.md` (then diff against prompt builders if needed)
3. Wire Next.js frontend to Python backend API — **contract SSOT:** [docs/V2_API_CONTRACT.md](V2_API_CONTRACT.md) (v1 `POST /api/chat` behavior, target `POST /chat` + Bearer, stream and error shapes, security and gap list).
4. Migrate relevant Postgres data to SQLite memory layer
5. Validate tool execution, night mode, and skills framework — map v1 tools with [docs/V2_TOOL_MAP.md](V2_TOOL_MAP.md) and v2 `tools/` registry in [V2_ARCHITECTURE.md](V2_ARCHITECTURE.md).
6. Decommission v1 backend (keep frontend)
