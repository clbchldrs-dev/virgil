# Sophon Workspace

Sophon lives in this repository as a related but bounded workspace.

## Why this exists

- Keep Sophon development clearly separated from core Virgil runtime code.
- Let Sophon evolve with its own docs, source layout, and tests.
- Preserve shared context and history in one git repository.

## Relationship to Virgil

- Same repository, separate workspace boundary.
- Shared infra and patterns can be reused intentionally.
- Changes should avoid coupling Sophon internals to Virgil app internals unless explicitly planned.

## Current scope

- Design-first and incremental implementation phase.
- Primary design spec: `docs/superpowers/specs/2026-04-05-sophon-daily-command-center-design.md`.

## Working conventions

- Put implementation code in `sophon/src/`.
- Put Sophon-specific tests in `sophon/tests/`.
- Put Sophon docs in `sophon/docs/`.
- Keep cross-project integration notes in top-level `docs/` when needed.

## Implemented v1 core (current)

- `src/types.ts` — candidate/ranked item contracts.
- `src/config.ts` — deterministic scoring constants.
- `src/priority-matrix.ts` — adaptive focus-count and deterministic ranking.
- `tests/priority-matrix.test.ts` — core behavior checks.

## In-app surfaces (Virgil)

- **UI:** signed-in users: **`/sophon`** — Daily command center (Now / Next / Later), add task, end-of-day review.
- **API:** `GET` / `POST` [`/api/sophon/daily`](../app/(chat)/api/sophon/daily/route.ts); `POST` [`/api/sophon/tasks`](../app/(chat)/api/sophon/tasks/route.ts).
- **Server helper:** [`lib/sophon/daily-brief.ts`](../lib/sophon/daily-brief.ts) — `getSophonDailyBriefForUser` (JSON-serializable brief for RSC and API).
