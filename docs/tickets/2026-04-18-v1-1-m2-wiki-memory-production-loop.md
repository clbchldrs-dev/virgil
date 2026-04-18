# M2 — Wiki memory production loop

**Status:** Planned  
**Program:** [2026-04-18-v1-1-full-feature-program-overview.md](2026-04-18-v1-1-full-feature-program-overview.md)

## Objective

Move the LLM Wiki path from scaffolded bridge behavior to a repeatable production loop for ingest, query, lint, and daily maintenance.

## Scope

- Hardening for wiki ops:
  - `POST /api/wiki/ops`
  - `GET /api/wiki/daily`
- Ensure provenance consistency and safe write behavior for wiki artifacts.
- Align retrieval/storage direction with ADR:
  - local self-hosted Postgres with `pgvector` + `tsvector`
  - evaluate Honcho fit against same host-level Postgres (shared DB vs adjacent DB)

## Key files

- `lib/wiki/service.ts`
- `app/api/wiki/ops/route.ts`
- `app/api/wiki/daily/route.ts`
- `workspace/wiki-starter/README.md`
- `docs/DECISIONS.md`
- `docs/V1_1_HERMES_WIKI_BOOTSTRAP.md`

## Acceptance criteria

- Ingest updates page(s), `wiki/index.md`, and `wiki/log.md` consistently.
- Query path is wiki-first and cites provenance references.
- Lint path reports contradictions/stale/orphan issues deterministically.
- Daily operation route produces valid artifacts and does not mutate `raw/` sources.
- ADR-consistent storage direction and Honcho evaluation notes are documented for operators.

## Verification

- `pnpm run type-check`
- `pnpm test:unit tests/unit/wiki-service.test.ts`
- Manual gated route checks with `CRON_SECRET` for `wiki/ops` and `wiki/daily`

## Out of scope

- Full v2 memory replatform implementation.
- Temporal workflow migration.
