# Enhancement backlog and review process

Project entrypoint and SSOT map: [docs/PROJECT.md](PROJECT.md). Phased Linux 24/7 roadmap: [docs/VIRGIL_ROADMAP_LINUX_24_7.md](VIRGIL_ROADMAP_LINUX_24_7.md). **Tracked implementation tickets:** [docs/tickets/README.md](tickets/README.md). **Phase Four (host cron / LAN env):** [AGENTS.md](../AGENTS.md#scheduled-jobs-on-the-host-no-vercel-cron), [AGENTS.md § self-hosted schedules](../AGENTS.md#self-hosted-schedules-no-vercel-cron).

Ideas worth evaluating for Virgil. The numbered items (E1–E11, …) are a living backlog; add new rows when you discover high-leverage work.

## Backlog

| ID | Area | Idea | Expected impact | Cost/complexity |
|----|------|------|-----------------|-----------------|
| E1 | local-perf | Dynamic Ollama model discovery from `/api/tags` | Easier setup, fewer hardcoded model assumptions | **Shipped:** `lib/ai/ollama-discovery.ts`, `/api/models`, `isAllowedChatModelId` |
| E2 | prompts | Per-model prompt variants beyond full/slim | Better quality on weak hardware | **Partially shipped:** `LocalModelClass` (`3b`/`7b`) + tag inference in [`lib/ai/models.ts`](../lib/ai/models.ts); slim/compact builders in [`lib/ai/slim-prompt.ts`](../lib/ai/slim-prompt.ts); ADR in [DECISIONS.md](DECISIONS.md). Further per-model tuning still TBD |
| E3 | local-perf | Smarter local context compression | Better continuity at same token budget | **Shipped:** overhead + long user/assistant compression + middle trim (`shrinkMiddleTrialToBudget`: assistant-before-user among removable; tool structural parts preserved until last resort) in [`lib/ai/trim-context.ts`](../lib/ai/trim-context.ts); ADR in [DECISIONS.md](DECISIONS.md) |
| E4 | reliability | Better local-model error surfacing in UI | Faster troubleshooting, less confusion | **Shipped:** persistent `ChatErrorBanner` + `lib/chat-error-display.ts`; toasts use same copy |
| E5 | business-mode | (Removed) Business/front-desk mode | N/A | **Removed (2026-04):** product is personal-assistant-only; `/preferences` is a minimal settings page |
| E6 | product-feedback | Collect ideas from people using [OpenClaw](https://github.com/openclaw/openclaw) (or similar channels); synthesize the most helpful or agentic ones into Virgil scope (ongoing: add rows to this table when you ship a synthesis pass). **In-app (gateway):** `submitProductOpportunity` → GitHub Issues — [docs/github-product-opportunity.md](github-product-opportunity.md). *Not* the same as optional OpenClaw **execution** in v1 — see [openclaw-bridge.md](openclaw-bridge.md). | Better roadmap from real usage; surfaces high-leverage features | **Partially shipped:** sanitized tool errors, reasoning/no-tools + workflow docs in [github-product-opportunity.md](github-product-opportunity.md); synthesis remains human-driven |
| E7 | night-review | UI to accept/reject night-review memories; richer digest merge for findings | Safer iteration on automated suggestions | **Partially shipped:** accept/dismiss + `includeDismissed`; grouped digest by run ([`lib/night-review/digest-display.ts`](../lib/night-review/digest-display.ts)), facet labels, batch accept/dismiss; further polish optional |
| E8 | lan-ops | Shorter **time-to-ready** after cold boot on LAN / Docker (Ubuntu-first) | Less waiting when the home server restarts | **Shipped:** health-gated `postgres`/`redis`/`ollama` → `virgil-app` in [`docker-compose.yml`](../docker-compose.yml); [`lib/ai/warmup-ollama.ts`](../lib/ai/warmup-ollama.ts) + `pnpm warmup:ollama`; [`docs/beta-lan-gaming-pc.md`](../docs/beta-lan-gaming-pc.md) systemd + timing checklist |
| E9 | agent-swarm | Agent task orchestration: submit improvements via chat, triage with local Ollama, Cursor/agent pickup | Virgil works on itself; 24/7 improvement cycle using local models during downtime | **Shipped:** `submitAgentTask` tool (gateway-only), `AgentTask` table, GitHub Issue mirroring, background triage worker (`lib/agent-tasks/`), API routes, Cursor pickup convention in [AGENTS.md](../AGENTS.md#agent-task-pickup-convention), **owner UI** at `/agent-tasks` (list, filter, approve/reject/done, triage notes, GitHub links). Future: auto-implement, GitHub Actions integration |
| E10 | v2-bridge | Groundwork so v1 iteration feeds June 2026 v2 split (Python backend, traces, budgets, persona SSOT) | De-risks migration; produces contracts + telemetry without building v2 in this repo | **Tickets:** [docs/tickets/2026-04-01-v2-groundwork-overview.md](tickets/2026-04-01-v2-groundwork-overview.md) (T1–T8). Docs-only + opt-in JSONL; persona SSOT: [docs/VIRGIL_PERSONA.md](VIRGIL_PERSONA.md) (2026-04-05) |
| E11 | proactive-pivot | Reactive chat → proactive agent (vector recall, goals, events/nudges, intent prompts, model cascade, summarization) per owner pivot prompt | Stronger goal awareness and nudges without abandoning local-first | **Epic:** [docs/tickets/2026-04-02-proactive-pivot-epic.md](tickets/2026-04-02-proactive-pivot-epic.md). **Phase 1 shipped:** pgvector + Ollama embeddings, recall order vector→FTS→Mem0. **Phase 2 shipped:** `Goal` / `GoalCheckIn`, tools + prompt context. **Remaining:** Phase 3+ (events/nudges after agentic ADR), intent, router, summarization |
| E12 | ops-rhythm | Slack standup loop for “employees” (Cursor, Clawleb, Virgil): daily yesterday/today/blockers updates to one shared channel | Better operational accountability and faster blocker surfacing | **Proposed:** task spec in [docs/tickets/2026-04-05-virg-e12-slack-employee-standups.md](tickets/2026-04-05-virg-e12-slack-employee-standups.md); reuse `digital-self` Slack adapter groundwork |
| E13 | delegation-ops | **Vercel Shape A end-to-end verification.** The in-app Hermes bridge (2026-04-19) + `pnpm virgil:start` orchestrator + poll worker together form Shape A: Vercel enqueues `PendingIntent` to Postgres, the Mac drains via `VIRGIL_DELEGATION_WORKER_BASE_URL` → local in-app bridge → OpenClaw tunnel. Tickets: verify end-to-end on Production with a low-risk `delegateTask`, capture `/api/delegation/health` + `/api/virgil/status` snapshots before/after, and add a 30-second operator smoke test to [docs/virgil-manos-delegation.md](virgil-manos-delegation.md). **Acceptance:** (1) `VIRGIL_DELEGATION_POLL_PRIMARY=1` + `VIRGIL_DELEGATION_WORKER_SECRET` set on Vercel Production; (2) Mac `.env.local` has matching worker secret + base URL + OpenClaw gateway token; (3) `pnpm virgil:start` on Mac shows `[app] [tunnel] [worker]` running; (4) a chat-driven `delegateTask` on prod returns a queued success, drains within a few seconds, and writes a `ClawResult` back; (5) kill the Mac → Vercel banner reads "Delegation offline — N task(s) queued… Run `pnpm virgil:start` locally" per the new `buildOfflineMessage`. | Proves the hosted-Vercel + LAN-OpenClaw story actually works and removes the "works on my laptop" gap | **Proposed (2026-04-19):** cross-link from [docs/virgil-manos-delegation.md](virgil-manos-delegation.md) once the smoke test doc lands |

## Review cadence

After each implementation session, the agent should:

1. Run the handoff checklist against the final diff (see [AGENTS.md](../AGENTS.md)).
2. Identify 1–3 new enhancement ideas from what was learned.
3. Add them to the backlog table above with impact/cost estimates.
4. Flag any regressions in local-model quality, latency, or reliability.

## Acceptance criteria for enhancements

- Does it make Virgil more helpful on local models?
- Does it reduce cost or keep it flat?
- Does it preserve or improve response quality?
- Can it be tested with `pnpm ollama:smoke`, focused unit tests, or clear manual QA?
