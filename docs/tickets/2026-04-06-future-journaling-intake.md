# Future — Journaling intake (not v0.6 scope)

**Theme:** First-class capture of journal-style text into Virgil’s cognitive layer without relying only on chat paste.

## Existing hooks

- `VIRGIL_JOURNAL_FILE_PARSE=1` — `GET/POST /api/journal/parse` (Bearer `CRON_SECRET`); filesystem or POST body on Vercel ([AGENTS.md](../../AGENTS.md)).
- Default path: `workspace/journal/today.md` (`VIRGIL_JOURNAL_FILE_PATH`).
- General bearer ingest: `POST /api/ingest` when `VIRGIL_INGEST_ENABLED=1`.

## Acceptance criteria (when picked up)

1. Clear owner story: file on disk vs mobile shortcut vs email → structured `Memory` or `Document` rows.
2. Idempotency or dedupe when the same day is parsed twice.
3. Prompt / privacy note: journaling may contain sensitive content; respect single-owner scope and retention.
4. Tests for parse boundary (empty file, huge file, UTF-8).

## References

- [docs/operator-integrations-runbook.md](../operator-integrations-runbook.md)
- [docs/DECISIONS.md](../DECISIONS.md) — any change to default night review or memory behavior needs ADR alignment.
