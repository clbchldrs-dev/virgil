# M2 — Wiki memory production loop

**Status:** Done  
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

## Progress notes (2026-04-18)

- Added explicit wiki safety coverage in `tests/unit/wiki-service.test.ts`:
  - traversal and non-markdown ingest rejection (`path_outside_root`, `source_must_be_markdown`)
  - daily maintenance verifies `raw/` source files remain unchanged
- Re-ran focused wiki test suite and type-check:
  - `node --test --import tsx tests/unit/wiki-service.test.ts`
  - `pnpm run type-check`
- Added deterministic lint ordering for reproducible outputs:
  - sorted markdown file traversal in `collectMarkdownFiles(...)`
  - stable issue ordering by `file` then `code` in `lintWiki()`
- Added route-level contract coverage in `tests/unit/wiki-routes.test.ts`:
  - `POST /api/wiki/ops` feature-flag and bearer auth gates
  - ingest happy path verifies source page, index, and log updates
  - `GET /api/wiki/daily` auth gate and artifact generation path
- Re-ran expanded wiki checks:
  - `node --test --import tsx tests/unit/wiki-service.test.ts tests/unit/wiki-routes.test.ts`
  - `pnpm run type-check`
- Added deterministic `stale_link` lint reporting in `lib/wiki/service.ts`:
  - wiki-link target normalization (`[[path]]`, `[[path|label]]`, `[[path#heading]]`)
  - missing target detection against known wiki pages
  - stable ordering kept via file/code sort
- Extended wiki service tests for stale-link behavior and daily output:
  - `lintWiki` now asserts stale-link issue generation
  - daily review test asserts stale-link visibility in issue preview
- Added operator-facing ADR alignment notes:
  - `workspace/wiki-starter/README.md`
  - `docs/V1_1_HERMES_WIKI_BOOTSTRAP.md`
  - both now call out local Postgres (`pgvector` + `tsvector`), Honcho evaluation posture, and Hermes → Postgres `SKIP LOCKED` → Temporal escalation order.
- Query path now enforces wiki-first prioritization + provenance citations:
  - `queryWiki(...)` reads `wiki/index.md` link targets first when ranking files
  - query matches now return `provenanceRefs` from `## Provenance` blocks
  - covered in `tests/unit/wiki-service.test.ts`
- Added deterministic contradiction lint reporting:
  - `lintWiki` now emits `contradiction` when a page has unresolved competing views in the `## Contradictions or competing views` section
  - covered by `lintWiki reports unresolved competing views as contradiction` in `tests/unit/wiki-service.test.ts`
- Re-ran final M2 verification:
  - `node --test --import tsx tests/unit/wiki-service.test.ts tests/unit/wiki-routes.test.ts`
  - `pnpm run type-check`

## Acceptance status snapshot (2026-04-18)

- **Ingest updates page/index/log consistently:** Met (`ingestWikiSource` + route tests)
- **Query path wiki-first + provenance citations:** Met (`queryWiki` index-prioritized ordering + `provenanceRefs`)
- **Lint reports contradictions/stale/orphan deterministically:** Met (`missing_provenance`, `orphan_page`, `stale_link`, `contradiction` with stable sort by file/code)
- **Daily route produces valid artifacts and does not mutate `raw/`:** Met (`runDailyWikiMaintenance` + route tests)
- **ADR-consistent storage direction + Honcho notes documented:** Met (`workspace/wiki-starter/README.md`, `docs/V1_1_HERMES_WIKI_BOOTSTRAP.md`)

## Closure notes (2026-04-18)

- M2 acceptance criteria are satisfied with deterministic ingest/query/lint/daily behavior and route-level coverage.
- Remaining work moves to M3+ scopes (interaction surfaces, reliability hardening), not wiki-loop fundamentals.

## Out of scope

- Full v2 memory replatform implementation.
- Temporal workflow migration.
