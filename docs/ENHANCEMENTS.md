# Enhancement backlog and review process

Project entrypoint and SSOT map: [docs/PROJECT.md](PROJECT.md). Phased Linux 24/7 roadmap: [docs/VIRGIL_ROADMAP_LINUX_24_7.md](VIRGIL_ROADMAP_LINUX_24_7.md). **Tracked implementation tickets:** [docs/tickets/README.md](tickets/README.md). **Phase Four (host cron / LAN env):** [AGENTS.md](../AGENTS.md#scheduled-jobs-on-the-host-no-vercel-cron), [AGENTS.md § self-hosted schedules](../AGENTS.md#self-hosted-schedules-no-vercel-cron).

Ideas worth evaluating for Virgil. The numbered items (E1–E8, etc.) are a living backlog; add new rows when you discover high-leverage work.

## Backlog

| ID | Area | Idea | Expected impact | Cost/complexity |
|----|------|------|-----------------|-----------------|
| E1 | local-perf | Dynamic Ollama model discovery from `/api/tags` | Easier setup, fewer hardcoded model assumptions | **Shipped:** `lib/ai/ollama-discovery.ts`, `/api/models`, `isAllowedChatModelId` |
| E2 | prompts | Per-model prompt variants beyond full/slim | Better quality on weak hardware | **Partially shipped:** `LocalModelClass` (`3b`/`7b`) + tag inference in [`lib/ai/models.ts`](../lib/ai/models.ts); slim/compact builders in [`lib/ai/slim-prompt.ts`](../lib/ai/slim-prompt.ts); ADR in [DECISIONS.md](DECISIONS.md). Further per-model tuning still TBD |
| E3 | local-perf | Smarter local context compression | Better continuity at same token budget | **Partially shipped:** per-message overhead + long user/assistant compression in [`lib/ai/trim-context.ts`](../lib/ai/trim-context.ts); ADR in [DECISIONS.md](DECISIONS.md). Deeper middle-selection heuristics still optional |
| E4 | reliability | Better local-model error surfacing in UI | Faster troubleshooting, less confusion | **Shipped:** persistent `ChatErrorBanner` + `lib/chat-error-display.ts`; toasts use same copy |
| E5 | business-mode | Make business mode explicitly toggleable in settings | Cleaner separation from personal mode | **Shipped:** `/preferences` + `setBusinessModeEnabled` (full profile still `/onboarding`) |
| E6 | product-feedback | Collect ideas from people using [OpenClaw](https://github.com/openclaw/openclaw) (or similar channels); synthesize the most helpful or agentic ones into Virgil scope (ongoing: add rows to this table when you ship a synthesis pass). **In-app (gateway):** `submitProductOpportunity` → GitHub Issues — [docs/github-product-opportunity.md](github-product-opportunity.md) | Better roadmap from real usage; surfaces high-leverage features | **Partially shipped:** sanitized tool errors, reasoning/no-tools + workflow docs in [github-product-opportunity.md](github-product-opportunity.md); synthesis remains human-driven |
| E7 | night-review | UI to accept/reject night-review memories; richer digest merge for findings | Safer iteration on automated suggestions | **Partially shipped:** accept/dismiss + `includeDismissed`; grouped digest by run ([`lib/night-review/digest-display.ts`](../lib/night-review/digest-display.ts)), facet labels, batch accept/dismiss; further polish optional |
| E8 | lan-ops | Shorter **time-to-ready** after cold boot on LAN / Docker (Ubuntu-first) | Less waiting when the home server restarts | **Shipped:** health-gated `postgres`/`redis`/`ollama` → `virgil-app` in [`docker-compose.yml`](../docker-compose.yml); [`lib/ai/warmup-ollama.ts`](../lib/ai/warmup-ollama.ts) + `pnpm warmup:ollama`; [`docs/beta-lan-gaming-pc.md`](../docs/beta-lan-gaming-pc.md) systemd + timing checklist |
| E9 | agent-swarm | Agent task orchestration: submit improvements via chat, triage with local Ollama, Cursor/agent pickup | Virgil works on itself; 24/7 improvement cycle using local models during downtime | **Shipped (MVP):** `submitAgentTask` tool (gateway-only), `AgentTask` table, GitHub Issue mirroring, background triage worker (`lib/agent-tasks/`), API routes, Cursor pickup convention in [AGENTS.md](../AGENTS.md#agent-task-pickup-convention). Future: auto-implement, UI for task management, GitHub Actions integration |

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
