# VIRG-E7 — Night insights UI + digest merge (suggest-only)

**Enhancement ID:** E7 ([ENHANCEMENTS.md](../ENHANCEMENTS.md))  
**Roadmap:** [Phase Three](../VIRGIL_ROADMAP_LINUX_24_7.md#phase-three-memory-synthesis-and-feedback-integration-e6-e7)  
**Status:** Partially shipped (2026-03-29) — grouped digest + batch actions + facet labels; further UX polish optional

## Problem

Night-review outputs should be **accepted or rejected** clearly; **digest merge** for findings must stay **suggest-only** and must **not** silently overwrite core system prompts.

## Shipped (baseline)

- `/night-insights` accept/dismiss flows; API `includeDismissed` ([ENHANCEMENTS.md](../ENHANCEMENTS.md)).

## Remaining work

- [x] **Digest merge:** group by `runId`, dedupe identical content, facet order + labels; batch accept/dismiss per run.
- [x] UX: fetch error alert; empty state when only completion rows; larger touch targets (`min-h-11`) on small screens.
- [x] Guardrails: [workspace/night/README.md](../../workspace/night/README.md) documents no prompt auto-write; night job remains read-only for workspace files.

## Acceptance criteria

1. User can understand **what** is being suggested and **approve/reject** without ambiguity.
2. Automated merge logic is **idempotent** and **logged** where appropriate (no PII in logs).
3. `pnpm check` passes.

## Key files

- `app/` routes under night-insights
- `workspace/night/` ([workspace/night/README.md](../../workspace/night/README.md))
- DB queries for night-review / memory suggestions

## Delegation

Frontend + API agent; may touch schema—coordinate migrations if needed.

**Explore handoff:** [2026-03-29-delegation-handoffs.md](2026-03-29-delegation-handoffs.md) (VIRG-E7 section).
