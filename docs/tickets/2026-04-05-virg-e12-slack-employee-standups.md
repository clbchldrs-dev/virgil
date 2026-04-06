# VIRG-E12 — Slack employee standups (Cursor, Clawleb, Virgil)

**Enhancement ID:** E12 ([ENHANCEMENTS.md](../ENHANCEMENTS.md))  
**Roadmap:** v1 stability / operations hygiene (post-P4 hardening)  
**Status:** Proposed (2026-04-05)

## Problem

Virgil, Cursor, and Clawleb are acting like operator employees, but there is no shared operational rhythm for daily accountability. Without a standup loop, work can drift and blockers surface late.

## Goal

Create a v1 task to wire a lightweight Slack standup flow where the three agents post concise daily updates to a shared channel and optionally flag blockers.

## Scope (v1 task definition)

- Define the standup contract:
  - participants: `Virgil`, `Cursor`, `Clawleb`
  - cadence: daily (timezone-aware)
  - format: yesterday / today / blockers
  - destination: one Slack channel for agent operations
- Define integration boundaries:
  - **v1 target:** reuse existing Slack adapter groundwork in [`digital-self/src/adapters/slack.ts`](../../digital-self/src/adapters/slack.ts) and webhook parsing in [`digital-self/src/webhooks/slack-parser.ts`](../../digital-self/src/webhooks/slack-parser.ts)
  - keep core Virgil chat path stable (no broad refactor of `app/(chat)/api/chat/route.ts`)
- Define operational safeguards:
  - explicit env var list and where each secret lives
  - rate/volume guardrails to avoid spam
  - failure behavior when Slack API is unreachable (retry/backoff + non-fatal)

## Acceptance criteria

1. A documented implementation plan exists for a daily standup post in Slack for all three agents.
2. Required secrets/env vars are documented in `.env.example` + `AGENTS.md` before coding starts.
3. Failure mode is safe: Slack outages do not break chat, and missed standups are observable.
4. A test plan exists (unit-level formatting + integration smoke for Slack delivery path).

## Key files to use when implementing

- `digital-self/src/adapters/slack.ts`
- `digital-self/src/webhooks/slack-parser.ts`
- `digital-self/src/app.ts`
- `digital-self/src/core/policy-engine.ts`
- `AGENTS.md`
- `.env.example`

## Notes

- This ticket adds the work item only. It does not implement Slack posting behavior in this pass.
- Keep single-owner safety posture: no autonomous external messaging beyond the explicit standup channel until approved.
