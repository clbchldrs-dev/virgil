# Virgil 1.1 wiki starter (`raw/`, `wiki/`, `schema/`)

Starter scaffold for a Karpathy-style LLM Wiki memory layer in Virgil 1.1.

## Purpose

- `raw/`: immutable source material (never edited by the agent)
- `wiki/`: LLM-maintained markdown knowledge base (persistent, compounding)
- `schema/`: operational rules and templates for ingest/query/lint

This is a bootstrap scaffold, not production code. It documents shape and conventions so the Hermes harness can maintain memory consistently.

## File tree

```text
workspace/wiki-starter/
  raw/
    README.md
  wiki/
    index.md
    log.md
    entities/_template.md
    concepts/_template.md
    projects/_template.md
    procedures/_template.md
  schema/
    AGENTS.md
```

## Operating model

1. **Ingest:** Read one source from `raw/`, update affected pages in `wiki/`, then append one entry to `wiki/log.md`.
2. **Query:** Read `wiki/index.md` first, then target relevant pages, cite source links where possible.
3. **Lint:** Periodically check contradictions, stale claims, missing links, and orphan pages.

## Non-negotiables

- Do not edit files under `raw/`.
- Do not write permanent claims without provenance links.
- Route high-confidence stable facts into `wiki/`; route uncertain notes as hypotheses.
- Keep an append-only trail in `wiki/log.md`.

## Operator storage direction (ADR-aligned)

- Durable retrieval for the wiki track targets **local self-hosted Postgres** with:
  - `pgvector` for semantic similarity
  - `tsvector` for lexical/full-text retrieval
- Honcho evaluation should run against the same host-level Postgres footprint (shared instance or adjacent DB), while keeping wiki markdown artifacts and provenance rules as a separate concern.
- If Hermes scheduling is insufficient for multi-step/crash-safe jobs, prefer a Postgres worker queue (`FOR UPDATE SKIP LOCKED`) before introducing Temporal-class orchestration.

Reference: [`docs/DECISIONS.md`](../../docs/DECISIONS.md) (2026-04-18 ADR).
