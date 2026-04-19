# Work tickets (tracked tasks)

**Prioritized product backlog:** [docs/ENHANCEMENTS.md](../ENHANCEMENTS.md) (E1–E11 themes and acceptance criteria). The files below are **itemized tickets** and epics—use ENHANCEMENTS for “what ships next”; use `/docs/tickets/` for deep specs and delegation handoffs.

Tickets itemize **future work** from the [Linux 24/7 roadmap](../VIRGIL_ROADMAP_LINUX_24_7.md) and cross-link [ENHANCEMENTS.md](../ENHANCEMENTS.md). Each file has acceptance criteria, file pointers, and delegation notes.

**Archived pre-implementation prompts:** [docs/archive/](../archive/) (not SSOT).

**v1 → v2 groundwork (two-sprint bridge):** [2026-04-01-v2-groundwork-overview.md](2026-04-01-v2-groundwork-overview.md) — T1–T8 tickets for API contract, tool map, eval instrumentation, memory blueprint, night parity, traces, cost telemetry, persona SSOT.

**Proactive agent pivot (E11):** [2026-04-02-proactive-pivot-epic.md](2026-04-02-proactive-pivot-epic.md) — phased vector/goals/events/intent/router/summarization; [PIVOT_EVENTS_AND_NUDGES.md](../PIVOT_EVENTS_AND_NUDGES.md); [2026-04-02-pivot-goals-layer-design.md](2026-04-02-pivot-goals-layer-design.md). **Tri-layer / v2 spike:** [2026-04-05-scheduling-symbolic-grounding-spike.md](2026-04-05-scheduling-symbolic-grounding-spike.md).

| ID | Ticket file | Enhancement / theme |
|----|-------------|---------------------|
| 1.1 program | [2026-04-18-v1-1-full-feature-program-overview.md](2026-04-18-v1-1-full-feature-program-overview.md) | Full-feature 1.1 milestone program (M1-M5: delegation, wiki loop, surfaces, reliability, release readiness) |
| Tri-layer | [2026-04-05-scheduling-symbolic-grounding-spike.md](2026-04-05-scheduling-symbolic-grounding-spike.md) | v2 spike: bounded scheduling + symbolic grounding (spec only; see [DECISIONS.md](../DECISIONS.md)) |
| E12 | [2026-04-05-virg-e12-slack-employee-standups.md](2026-04-05-virg-e12-slack-employee-standups.md) | Slack standup loop for Cursor, Clawleb, and Virgil — **partial:** digest → Slack mirror ([operator-integrations-runbook.md](../operator-integrations-runbook.md)) |
| Future | [2026-04-06-future-journaling-intake.md](2026-04-06-future-journaling-intake.md) | Journaling intake (file/ingest/journal parse hooks) |
| Future | [2026-04-06-future-dreams-nightly-productivity.md](2026-04-06-future-dreams-nightly-productivity.md) | Dreams + nightly productivity signals (night review extension) |
| Future | [2026-04-06-future-ui-refinements.md](2026-04-06-future-ui-refinements.md) | Chat UI incremental refinements |
| E2 | [2026-03-29-virg-e2-per-model-prompt-variants.md](2026-03-29-virg-e2-per-model-prompt-variants.md) | Per-model prompt variants (3B vs 7B) — **partially shipped** (`LocalModelClass` + slim/compact) |
| E3 | [2026-03-29-virg-e3-smart-context-compression.md](2026-03-29-virg-e3-smart-context-compression.md) | Smarter `trim-context` — **partially shipped** (overhead + long-message cap) |
| E6 | [2026-03-29-virg-e6-product-feedback-synthesis.md](2026-03-29-virg-e6-product-feedback-synthesis.md) | Product feedback + synthesis — **partially shipped** (docs + sanitization) |
| E7 | [2026-03-29-virg-e7-night-insights-digest-merge.md](2026-03-29-virg-e7-night-insights-digest-merge.md) | Night insights UI + digest merge — **partially shipped** (grouped digest + batch) |
| E8-follow | [2026-03-29-virg-e8-nvidia-container-toolkit.md](2026-03-29-virg-e8-nvidia-container-toolkit.md) | NVIDIA Container Toolkit + Compose GPU |
| P4 | [2026-03-29-virg-p4-production-hardening.md](2026-03-29-virg-p4-production-hardening.md) | Host cron, LAN auth, env doc audit — **shipped** |

**Delegation handoffs (explore agents, 2026-03-29):** [2026-03-29-delegation-handoffs.md](2026-03-29-delegation-handoffs.md) — code pointers and gaps before implementation.

**Future (monetization / ops):** [future-monetization-product-opportunity-limits.md](future-monetization-product-opportunity-limits.md)

**Older tickets:** [2026-03-28-ollama-local-model.md](2026-03-28-ollama-local-model.md)
