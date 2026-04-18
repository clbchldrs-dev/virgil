# Virgil execution timeline: today -> June -> August

This runbook turns the current direction into a concrete sequence:

- **Now:** Virgil 1.1 bridge in current shell (Hermes harness + LLM Wiki memory)
- **June:** Mac mini arrives (primary always-on host for v2 backend)
- **August:** tiiny.ai arrives (heavy reasoning tier)

This document is operational planning only. It does not declare v2 implementation active in this repo.

## Current state (completed today)

- Hermes Agent installed on this Mac Air (`~/.local/bin/hermes`).
- Installation health checked with `hermes doctor`.
- Bridge ADR and wiki scaffold are in-repo:
  - [`docs/DECISIONS.md`](DECISIONS.md) (2026-04-16 ADR)
  - [`docs/V1_1_HERMES_WIKI_BOOTSTRAP.md`](V1_1_HERMES_WIKI_BOOTSTRAP.md)
  - [`workspace/wiki-starter/README.md`](../workspace/wiki-starter/README.md)

### Hermes CLI baseline (reconciled 2026-04-18)

Machine check on operator Mac Air:

- `hermes skills list`: OK — index initialized (79 builtin, 0 hub-installed, 0 local).
- `hermes doctor` (second pass): Google Gemini OAuth logged in; `~/.hermes/.env` has no generic API key entries (doctor still recommends `hermes setup` for full tool access and optional keys).
- Optional tools reported missing keys or system deps (OpenRouter, web search, Home Assistant, etc.) — ignore until needed.

**Still on the Hermes CLI side:** run `hermes setup` in a real TTY if you want doctor-clean API key lines and fewer nags; optional `hermes doctor --fix` for auto-fixables; npm audit paths under agent-browser / WhatsApp bridge only if you use those features.

**Separate from the CLI:** Virgil’s HTTP bridge (`HERMES_*` in `.env.local`, health and skills from the Next.js app) — verify when finishing delegation wiring in-repo.

## Remaining on Hermes CLI (manual, interactive terminal)

Done 2026-04-18:

- `hermes skills list` once (initialize index)
- `hermes doctor` again (snapshot captured in this section)

Because setup auth flows require a real TTY, finish when ready:

1. Run `hermes setup` (interactive wizard) — or defer if Gemini OAuth + current keys are enough for your workflow.
2. Re-run `hermes doctor` after setup and update this subsection if the baseline changes.

## Phase A: Virgil 1.1 bridge (before Mac mini)

Goal: prove Hermes + LLM Wiki pattern in daily use without destabilizing current v1.

Execution reference:
[`docs/V1_1_IMPLEMENTATION_CHECKLIST.md`](V1_1_IMPLEMENTATION_CHECKLIST.md)

### Build checklist

- Add Hermes adapter boundary (keep OpenClaw compatibility path behind config).
- Keep existing approval/escalation/spend controls as hard gates.
- Wire wiki lifecycle routines:
  - ingest -> update wiki pages + index + append log
  - query -> wiki-first response with provenance
  - lint -> contradiction/orphan/staleness checks
- Start with one repeated workflow (daily planning or project status loop).

### Exit criteria

- One week of stable bridge usage.
- No regression in existing safety posture.
- Wiki artifact grows with clean provenance and useful retrieval.
- Delegation degradation is safe: backend offline keeps intents queued (no unsafe bypass), and retry is possible after recovery.

## Phase B: June cutover prep (Mac mini arrives)

Goal: move primary orchestration and memory maintenance to the always-on host.

### Host responsibilities

- Mac mini: orchestration + fast local inference + persistent memory maintenance.
- Current app shell: remains interaction surface while cutover is staged.

### Cutover checklist

- Bring up Hermes on Mac mini.
- Mirror `workspace/wiki-starter` structure (or promote to canonical memory repo).
- Move scheduled jobs (ingest/lint/night runs) to Mac mini timers/cron.
- Run side-by-side validation (Mac Air vs Mac mini outputs on same inputs).

### Exit criteria

- Mac mini runs the bridge stack continuously.
- Daily tasks continue without manual host switching.
- Recovery steps are documented and tested once.

### Recovery / failover runbook (minimum)

1. Confirm backend health (`/api/openclaw/pending` reports active backend status, backlog, and offline message).
2. If backend is down, keep queue intact and restore service first (do not manually bypass approval gates).
3. Retry queued intents after health returns; verify status transitions `pending|confirmed -> sent -> completed`.
4. For wiki bridge maintenance:
   - manual ops: `POST /api/wiki/ops` (gated)
   - daily run: `GET /api/wiki/daily` (gated)
5. If host migration is needed, copy/sync `workspace/wiki-starter` before re-enabling daily runs.

## Phase C: August scale-up (tiiny.ai arrives)

Goal: separate heavy reasoning from orchestration while keeping model-agnostic routing.

### Role split

- Mac mini: orchestrator + fast/medium tasks + memory maintenance.
- tiiny.ai: heavy planning, deep synthesis, large-context reasoning.

### Checklist

- Add routing policy by task class (fast vs heavy).
- Validate fallback behavior when tiiny is unavailable.
- Measure cost/latency/quality deltas against June baseline.
- Keep `hermes model` swapability and avoid hardcoded model assumptions.

### Exit criteria

- Heavy-tier offload is reliable and improves quality/latency where expected.
- Failure of tiiny does not break core daily workflows.

## Operator notes

- Treat this as a **bridge-to-v2** execution guide, not a rewrite directive.
- Preserve the single-owner safety model through every phase.
- Keep decision updates in [`docs/DECISIONS.md`](DECISIONS.md) as each phase locks.
