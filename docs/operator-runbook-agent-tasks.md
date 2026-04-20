# Operator runbook — agent tasks (self-improve loop)

## Purpose

Agent tasks are **structured self-improvement items** created from chat (`submitAgentTask`, gateway models). The **owner** controls lifecycle in-app at `/agent-tasks`. This runbook describes **impact tiers**, **approval checkpoints**, and **Postgres vs GitHub** so operators know what the system guarantees.

## Impact tiers (`standard` vs `elevated`)

Rules are implemented in `lib/agent-tasks/impact-tier.ts` (single source of truth).

| Tier | When | Approval gate |
|------|------|----------------|
| **elevated** | `taskType` is `infra`, **or** `priority` is `critical`, **or** (`priority` is `high` and `taskType` is `feature` or `bug`) | Extra checkpoint before `approved` (see below) |
| **standard** | All other combinations | In-app approve only |

Optional override: `metadata.impactTierOverride` = `"standard"` | `"elevated"` when product needs an exception.

## Tiered approval checkpoints

1. **GitHub integration configured** (`GITHUB_REPOSITORY` + agent-task token — see `lib/github/agent-task-issue.ts`): **elevated** tasks must have a **non-empty `githubIssueUrl`** on the row before approval. Issues are normally created when the task is submitted; if creation failed, fix GitHub configuration or recreate the task.
2. **GitHub not configured**: **elevated** tasks require an explicit **out-of-band acknowledgment** (checkbox on `/agent-tasks`), stored as `metadata.outOfBandAcknowledgedAt`.

Triage **never** approves tasks — it only writes advisory `agentNotes`. See `lib/agent-tasks/triage-prompt.ts`.

## Postgres vs GitHub

- **Canonical state** for workflow (`submitted` → `approved` → …) lives in **Postgres** (`AgentTask`).
- **GitHub Issues** are a **mirror** for tracking when integration is enabled.
- If an issue title/body diverges from the DB row, **treat Postgres as source of truth** and align GitHub manually, or close the issue and open a new one. Automated two-way sync is **not** part of the default product (optional future webhook).

## Related docs

- [docs/memory-store-parity.md](memory-store-parity.md) — HTTP memory bridge for CLI / multi-machine parity with the same Postgres.
- [AGENTS.md](../AGENTS.md) — Agent Task Pickup Convention, API summary, triage env.
