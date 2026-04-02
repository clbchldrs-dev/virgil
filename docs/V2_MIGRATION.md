# Virgil v1 → v2 Migration Path

## What carries forward from v1

- **Chat UI and auth system** — The Next.js frontend becomes the UI layer for v2's Python backend.
- **Personality work** — `lib/ai/companion-prompt.ts` and `lib/ai/slim-prompt.ts` seed v2's `persona.md`.
- **Tool architecture** — `lib/ai/tools/` (one tool per file) maps to v2's `tools/` directory pattern.
- **Agent task pipeline** — `lib/agent-tasks/` is the conceptual ancestor of v2's night mode.
- **Docker Compose setup** — Adaptable for v2's Python services.
- **AGENTS.md handoff pattern** — Adopted directly in v2.

## What gets replaced

- **Inference layer** — Ollama on GTX 1070 → local Apple Silicon inference (MLX/Ollama) on new hardware.
- **Database** — Postgres/Drizzle → SQLite + Mem0 (simpler, no server dependency).
- **Backend runtime** — Next.js API routes → Python FastAPI (headless).
- **Memory** — Redis + Postgres → Three-tier SQLite/Mem0 with priority weighting.

## What's new in v2

- Tool execution (Virgil can act, not just advise)
- Night mode (autonomous work window while Caleb sleeps)
- Skills/plugin system (modular capabilities without core changes)
- API cost tracking and budget management
- Self-evaluation and memory consolidation
- Split frontend (Vercel) / backend (local hardware) architecture

## Pre-migration data collection (active now)

See `workspace/v2-eval/README.md` for what v1 is collecting to inform v2 development.

**Execution plan:** [docs/tickets/2026-04-01-v2-groundwork-overview.md](tickets/2026-04-01-v2-groundwork-overview.md) — two-sprint ticket set (API contract, tool map, chat instrumentation, memory blueprint, night parity, traces, cost telemetry, persona SSOT).

## Migration steps (execute in June 2026)

1. Stand up Python backend on new hardware
2. Port persona from companion-prompt.ts → persona.md
3. Wire Next.js frontend to Python backend API
4. Migrate relevant Postgres data to SQLite memory layer
5. Validate tool execution, night mode, and skills framework
6. Decommission v1 backend (keep frontend)
