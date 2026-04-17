# Wiki schema contract (Virgil 1.1 bridge)

This schema defines how the memory wiki is maintained.

## Directory contract

- `raw/` is immutable source-of-truth material.
- `wiki/` is mutable compiled knowledge.
- `schema/` defines behavior, templates, and validation rules.

## Allowed operations

### Ingest

1. Read one source from `raw/`.
2. Update any relevant pages in `wiki/`.
3. Update `wiki/index.md` if page set changed.
4. Append exactly one entry to `wiki/log.md`.

### Query

1. Read `wiki/index.md`.
2. Read target wiki pages.
3. Answer with explicit citations to wiki pages and source links.
4. If new synthesis is valuable, file it as a wiki page.

### Lint

Run periodic checks for:

- contradictions between pages
- stale claims superseded by newer evidence
- orphan pages with no inbound links
- low-confidence claims lacking follow-up

## Promotion rules (memory tiering)

- Working notes stay in page-local draft sections.
- Episodic summaries require at least one source citation.
- Semantic facts require repeated evidence or explicit confirmation.
- Procedural updates require human review.

## Hard safety constraints

- Never modify files in `raw/`.
- Never delete historical entries from `wiki/log.md`.
- Never elevate a claim to high confidence without provenance.
- Never emit side-effect recommendations that bypass escalation floors.
