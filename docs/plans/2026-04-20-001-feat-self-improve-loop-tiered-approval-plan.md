---
title: Self-improve loop — tiered approval, audit trail, and operator clarity
type: feat
status: active
date: 2026-04-20
origin: docs/brainstorms/2026-04-20-chief-of-staff-self-improve-orchestration-requirements.md
---

# Self-improve loop — tiered approval, audit trail, and operator clarity

## Overview

Strengthen the **agent task** self-improvement loop so it matches the brainstorm intent (see origin): **tiered approval** for high-impact work, **clear separation** between triage signal and owner approval, **durable traceability**, and **operator-visible** posture for triage and orchestration-related env—without building autonomous merge or multi-tenant workflows.

## Problem Frame

Virgil already has structured intake (`submitAgentTask`), chat tool approval (`needsApproval`), owner workflow on `/agent-tasks`, local triage (`lib/agent-tasks/triage-worker.ts`), and optional delegation of approved tasks (`lib/agent-tasks/delegate-approved-task.ts`). What is missing is an **explicit, documented, and UX-enforced** distinction between **routine** approvals and **high-impact** approvals (see origin **Key Decisions**), plus lightweight **feedback/audit** hooks and **failsafe clarity** when automation paths are offline.

## Requirements Trace

| ID | Requirement (from origin) | Plan response |
|----|-----------------------------|-----------------|
| R1 | Human approval; tiered policy | Impact tier model + UI gate + operator docs |
| R2 | Structured intake / lifecycle | Preserve; optional completion metadata |
| R3 | Triage is signal, not authority | Prompt + schema alignment + test |
| R4 | Feedback into quality (auditable) | Optional completion summary in metadata + display |
| R5 | Degraded honesty | Copy on `/agent-tasks` + command center when triage/delegation unavailable |
| R6 | Queue durability | Document Postgres as SoT; GitHub playbook |
| R7 | Ubiquitous mental model | Cross-link memory bridge + API from operator doc |
| R8 | Budgeted orchestration | Surface planner/delegation env hints on deployment diagnostics |
| R9 | Observability | Same surface + existing logs; no new product analytics required in v1 |

## Scope Boundaries

- Does **not** add unsupervised auto-merge, CI bots that commit without humans, or multi-tenant approval roles.
- Does **not** require v2 Python backend.
- Does **not** implement GitHub issue webhooks for two-way sync in this plan (playbook only; defer if needed).

### Deferred to Separate Tasks

- **GitHub → Postgres state sync automation** (webhooks or periodic reconcile job): only if operator pain justifies it after playbook use.

## Context & Research

### Relevant Code and Patterns

- Schema: `lib/db/schema.ts` — `AgentTask` (`taskType`, `priority`, `status`, `githubIssueUrl`, `metadata`, `agentNotes`).
- Tool: `lib/ai/tools/submit-agent-task.ts` — gateway-only; `needsApproval: true`.
- API: `app/(chat)/api/agent-tasks/route.ts` — GET list, PATCH status (no tier checks today).
- UI: `app/(chat)/agent-tasks/agent-tasks-client.tsx` — filters, transitions, delegate action.
- Triage: `lib/agent-tasks/triage-worker.ts`, `lib/agent-tasks/triage-prompt.ts`, `lib/agent-tasks/schema.ts`.
- Delegation: `lib/agent-tasks/delegate-approved-task.ts`, `lib/integrations/delegation-provider.ts`.
- Multi-agent orchestration env: `lib/ai/orchestration/multi-agent.ts`, chat route integration.
- Deployment UX: `app/(chat)/deployment/` and `lib/deployment/` (extend only if a clear pattern exists).

### Institutional Learnings

- Tool approval and policy patterns: `docs/security/tool-inventory.md`, `lib/ai/tool-policy.ts`.
- Prior security plan reference: `docs/superpowers/plans/2026-03-29-security-hardening-agents.md` (approval UX patterns).

### External References

- None required for v1; tier policy is product-specific.

## Key Technical Decisions

- **Impact tier is derived**, not a separate DB column initially: reduces migration risk; map `(taskType, priority)` to `standard` | `elevated` with rules codified in one module. If product needs overrides later, add optional `metadata.impactTierOverride` in a follow-up.
- **Elevated tier enforcement is “soft but visible”** for single-owner: UI friction + documentation + optional PATCH warning response body—not hard 403—unless a future audit demands strict server deny-list.
- **Postgres is source of truth** for task status; GitHub Issues are a **mirror** when configured (see origin deferred question).

## Open Questions

### Resolved During Planning

- **High-impact definition (`elevated`):** Any of: `taskType === "infra"`; `priority === "critical"`; or (`priority === "high"` and `taskType` is `feature` or `bug`). All other combinations are **`standard`** unless `metadata.impactTierOverride` is added later.
- **Out-of-band checkpoint for `elevated`:**
  - **GitHub issue integration configured** (`isAgentTaskGitHubConfigured()`): require a **non-empty `githubIssueUrl`** on the task before PATCH to `approved` (issue is normally created at submit time; this catches misconfiguration or failed issue creation). If URL is missing, show recovery instructions (linking issue manually is a follow-up enhancement—document in runbook).
  - **GitHub not configured:** require PATCH body field acknowledging out-of-band review, stored as `metadata.outOfBandAcknowledgedAt` (ISO timestamp), before `approved`.

### Deferred to Implementation

- Exact copy strings for command-center banners.
- Whether PATCH should return structured `{ tier, warnings }` on every status change or only when transitioning to `approved`.

## High-Level Technical Design

> *Directional guidance for review, not implementation specification.*

```mermaid
flowchart LR
  subgraph intake [Intake]
    T[submitAgentTask tool]
    DB[(AgentTask Postgres)]
  end
  subgraph signal [Signal]
    TR[Triage worker]
    DB
  end
  subgraph gate [Tiered approval]
    UI[/agent-tasks UI]
    OOB[Out-of-band checkpoint]
    UI --> OOB
    OOB -->|approved| DB
  end
  subgraph exec [Execution]
    DEL[delegateApprovedAgentTask]
    DEL --> GW[Delegation]
  end
  T --> DB
  TR -->|agentNotes only| DB
  DB --> UI
```

## Phased Delivery

### Phase 1 — Policy + purity

Tier resolution, triage non-authority guarantees, operator documentation.

### Phase 2 — UX + API alignment

Approval friction for elevated tasks, optional completion summary, deployment/diagnostics hints.

### Phase 3 — Playbook + polish

GitHub/Postgres playbook, command-center degradation copy, tests.

## Implementation Units

- [ ] **Unit 1: Impact tier resolution module**

**Goal:** Single source of truth for `standard` vs `elevated` impact given task fields.

**Requirements:** R1

**Dependencies:** None

**Files:**
- Create: `lib/agent-tasks/impact-tier.ts`
- Test: `tests/unit/agent-task-impact-tier.test.ts`

**Approach:**
- Export `AgentTaskImpactTier` type and `resolveAgentTaskImpactTier(input)` reading `taskType`, `priority`, and optional `metadata.impactTierOverride` (string enum) for future flexibility.
- Document the default mapping in file header comments; keep rules easy to adjust.

**Test scenarios:**
- Happy path: `infra` + `low` → elevated.
- Edge: `docs` + `critical` → elevated (critical priority).
- Edge: `prompt` + `medium` → standard.
- Edge: `feature` + `high` → elevated; `feature` + `medium` → standard.
- Edge: valid `metadata.impactTierOverride` wins when present (if implemented).

**Verification:** Unit tests pass; mapping matches table in Unit 4 docs.

---

- [ ] **Unit 2: Triage cannot approve — prompt and schema guardrails**

**Goal:** Make it impossible for triage output to imply status changes; reinforce R3 in model instructions.

**Requirements:** R3

**Dependencies:** Unit 1 optional (no hard dependency)

**Files:**
- Modify: `lib/agent-tasks/triage-prompt.ts`
- Modify: `lib/agent-tasks/schema.ts` (if schema text fields could encode status language—tighten descriptions only)
- Test: `tests/unit/agent-task-triage-guardrails.test.ts` (string checks on prompt export or snapshot of key sentences)

**Approach:**
- Add explicit bullets: triage **must not** set or imply workflow status; notes are advisory only.

**Test scenarios:**
- Happy path: exported system prompt contains forbidden-action language.
- Edge: schema field descriptions do not mention `approved` / `rejected` as outputs.

**Verification:** Tests pass; triage worker still runs unchanged logically.

---

- [ ] **Unit 3: Elevated approval checkpoint — UI + optional API metadata**

**Goal:** When approving an **elevated** task, owner completes an out-of-band checkpoint before `approved`.

**Requirements:** R1

**Dependencies:** Unit 1

**Files:**
- Modify: `app/(chat)/agent-tasks/agent-tasks-client.tsx`
- Modify: `app/(chat)/api/agent-tasks/route.ts` (optional: accept `outOfBandAck` or validate `githubIssueUrl` when GitHub configured)
- Modify: `lib/db/query-modules/agent-task.ts` only if PATCH plumbing needs new fields in `metadata`

**Approach:**
- On transition to `approved`, compute tier via `resolveAgentTaskImpactTier`.
- **If elevated and GitHub configured:** client disables approve until `githubIssueUrl` is set; server returns **400** with clear message if PATCH attempts `approved` without URL (soft-hard gate—owner can fix data then retry).
- **If elevated and GitHub not configured:** client requires checkbox; PATCH includes acknowledgment timestamp in `metadata` via extended PATCH schema.
- Keep single-owner trust: no new roles; server validation is consistency, not enterprise RBAC.

**Test scenarios:**
- Happy path (standard task): approve without extra steps.
- Edge (elevated + GitHub configured): UI blocks until issue URL exists (mock config in test if extract helpers to pure functions).
- Error path: PATCH with invalid body rejected 400.

**Verification:** Manual smoke on `/agent-tasks` for both tiers; unit tests for zod parsing if extracted.

---

- [ ] **Unit 4: Operator runbook + AGENTS alignment**

**Goal:** Durable documentation for tiers, SoT, and rituals (see R6, R7).

**Requirements:** R1, R6, R7

**Dependencies:** Unit 1

**Files:**
- Create: `docs/operator-runbook-agent-tasks.md`
- Modify: `AGENTS.md` (Agent Task Pickup / optional features pointer)
- Modify: `SETUP.md` (optional table row if not redundant)

**Approach:**
- One page: tier table, triage limitations, Postgres vs GitHub, link to `docs/memory-store-parity.md` for CLI parity.

**Test expectation:** none — documentation only.

**Verification:** Doc links resolve; AGENTS anchors updated.

---

- [ ] **Unit 5: Completion feedback hook**

**Goal:** Satisfy R4 minimally with auditable **optional** completion notes.

**Requirements:** R2, R4

**Dependencies:** None (can parallelize after Unit 3)

**Files:**
- Modify: `app/(chat)/api/agent-tasks/route.ts` — allow optional `completionSummary` in PATCH when `status === "done"` (stored under `metadata.completionSummary`)
- Modify: `app/(chat)/agent-tasks/agent-tasks-client.tsx` — optional textarea when marking done
- Test: `tests/unit/agent-task-patch-metadata.test.ts` (if logic extracted) or API unit test

**Test scenarios:**
- Happy path: done + summary persists in metadata returned by GET.
- Edge: done without summary leaves metadata unchanged aside from completion.

**Verification:** GET shows summary in task detail row or expandable section.

---

- [ ] **Unit 6: Degradation copy — triage and delegation**

**Goal:** R5 clarity when workers or gateways are misconfigured.

**Requirements:** R5

**Dependencies:** None

**Files:**
- Modify: `app/(chat)/agent-tasks/agent-tasks-client.tsx` and/or `components/command-center/background-activity-sections.tsx`
- Possibly: `lib/integrations/delegation-provider.ts` consumers for status booleans

**Approach:**
- Use existing `GET /api/virgil/status` or delegation health helpers if already on client; otherwise lightweight fetch to `/api/deployment/capabilities` or a minimal new field—**prefer reusing** existing deployment capabilities data to avoid new endpoints.
- Show non-blocking banner: triage off, delegation offline, etc.

**Test scenarios:**
- Test expectation: none or shallow component test if banner extracted.

**Verification:** With `AGENT_TASK_TRIAGE_ENABLED=0` and missing delegation, user sees accurate limitation text.

---

- [ ] **Unit 7: Orchestration / delegation operator hints**

**Goal:** R8–R9 — surface env posture without new analytics product.

**Requirements:** R8, R9

**Dependencies:** None

**Files:**
- Modify: `lib/deployment/delegation-snapshot.ts` or deployment page data loader (whichever lists capabilities today)
- Modify: related deployment UI component under `app/(chat)/deployment/`

**Approach:**
- Append read-only lines when relevant env vars are set: e.g. `VIRGIL_MULTI_AGENT_ENABLED`, `VIRGIL_MULTI_AGENT_PLANNER_CHAIN`, `AGENT_TASK_TRIAGE_ENABLED` (sanitized, no secrets).

**Test scenarios:**
- Unit test for formatting helper if extracted.

**Verification:** Deployment page shows consistent labels in dev and prod builds.

---

- [ ] **Unit 8: GitHub vs Postgres playbook**

**Goal:** Address deferred reconciliation question with **process**, not automation.

**Requirements:** R6

**Dependencies:** Unit 4

**Files:**
- Modify: `docs/operator-runbook-agent-tasks.md` (subsection)

**Approach:**
- Document: canonical state in Postgres; GitHub issue is tracking mirror; if they diverge, operator resolves manually; optional future webhook listed as out of scope.

**Test expectation:** none.

**Verification:** Peer review of doc.

## System-Wide Impact

- **Interaction graph:** PATCH `/api/agent-tasks` gains optional fields; triage prompt text changes only affect worker.
- **Error propagation:** Approve flow must return clear 400 messages for missing elevated prerequisites.
- **State lifecycle risks:** Metadata merges must preserve existing keys when updating `completionSummary` or acknowledgments.
- **API surface parity:** Chat tool `submitAgentTask` unchanged; tier is derived server-side from stored fields.
- **Unchanged invariants:** Guest restrictions, session auth on routes, triage still does not call `updateAgentTaskStatus`.

## Risks & Dependencies

| Risk | Mitigation |
|------|------------|
| Elevated rules frustrate single owner | Soft gates + clear copy; easy override via metadata override later |
| PATCH body expansion breaks clients | Backward-compatible optional fields only |
| Over-scoping deployment UI | Keep to read-only strings; no new charts |

## Documentation / Operational Notes

- `AGENTS.md` env table: add pointers if new env vars are introduced (prefer none).
- Runbook is the operator SSOT for tiers and reconciliation.

## Sources & References

- **Origin document:** [docs/brainstorms/2026-04-20-chief-of-staff-self-improve-orchestration-requirements.md](../brainstorms/2026-04-20-chief-of-staff-self-improve-orchestration-requirements.md)
- Related code: `lib/agent-tasks/`, `app/(chat)/agent-tasks/`, `app/(chat)/api/agent-tasks/route.ts`
- Security context: [docs/security/tool-inventory.md](../security/tool-inventory.md)
