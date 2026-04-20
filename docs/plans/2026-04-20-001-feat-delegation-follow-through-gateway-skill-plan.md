---
title: "feat: Delegation visibility follow-through + one gateway skill (operator path)"
type: feat
status: active
date: 2026-04-20
origin: docs/brainstorms/2026-04-19-hermes-openclaw-delegation-access-requirements.md
prior_plan: docs/plans/2026-04-19-003-feat-delegation-capabilities-surface-plan.md
---

# feat: Delegation visibility follow-through + one gateway skill (operator path)

## Overview

Brainstorm outcome: **prioritize product legibility for delegation (3)** and add **a small amount of new LAN capability (1)** — one exemplar gateway skill, not an open-ended catalog.

The **core Virgil implementation** for R1–R3 (deployment snapshot, `/deployment` UI, companion prompt appendix, TTL + freshness, runbook links) is **already delivered** — see completed units in [docs/plans/2026-04-19-003-feat-delegation-capabilities-surface-plan.md](2026-04-19-003-feat-delegation-capabilities-surface-plan.md). This plan covers **verification**, **optional residual polish**, and **operator-runbook steps** to add **one** skill on Hermes/OpenClaw so the live list gains a real new id end-to-end.

## Problem Frame

After shipping the capabilities surface, the remaining risk is **drift**: docs/env names diverge from code, or operators never complete the **gateway-side** half of “more tools.” A single **documented, repeatable** path to register one new skill — plus a tight **verification** pass — closes the loop between “Virgil shows skills” and “those skills do something useful.”

## Requirements Trace

- **R1–R2 (verification)** — Confirm deployment capabilities API and UI still match `lib/deployment/delegation-snapshot.ts` behavior; freshness signals remain trustworthy after any unrelated churn.
- **R3 (spot-check)** — Companion `delegationCapabilityAppendix` stays aligned with the same snapshot source (`getDelegationDeploymentSnapshot`); no duplicate skill lists with conflicting semantics.
- **R5** — Already resolved in prior plan: **failover-only**, no per-intent backend pin — verify copy in `components/deployment/capabilities-panel.tsx` and `AGENTS.md` still matches `delegation-provider` (see origin: `docs/brainstorms/2026-04-19-hermes-openclaw-delegation-access-requirements.md`).
- **R6** — Runbook remains **load-bearing**: one new skill must be reproducible from docs without reading source.
- **R7 (optional)** — Short operator checklist on `/deployment` or settings — only if scoped; not required to ship “one skill” path.
- **“Bit of 1”** — **One** new skill id appears on the gateway, in Virgil’s skill list after refresh, and succeeds via a safe `delegateTask` smoke — **implemented on the gateway host**, documented in-repo.

## Scope Boundaries

- **In scope:** Verification tests/checklists, small doc updates in `docs/openclaw-bridge.md`, `docs/virgil-manos-delegation.md`, and/or `AGENTS.md` delegation pointers; optional minimal UI for R7.
- **Out of scope:** Changing Hermes/OpenClaw **wire protocols**, implementing skills inside third-party repos in this PR, or adding per-request backend selection (explicit non-goal per prior plan).
- **Deferred to Separate Tasks**

  - **Rich skill metadata** (descriptions in UI beyond ids) — only after gateway payloads stabilize.
  - **Second and third custom skills** — repeat the same runbook; do not expand scope here.

## Context & Research

### Relevant Code and Patterns

- `lib/deployment/delegation-snapshot.ts` — TTL cache, `skillsStatus`, `getDelegationDeploymentSnapshot({ bypassCache })`.
- `lib/deployment/capabilities.ts` — `buildDeploymentCapabilities({ bypassDelegationCache })`.
- `app/(chat)/api/deployment/capabilities/route.ts` — capabilities JSON.
- `components/deployment/capabilities-panel.tsx` — delegation block, refresh button, skill list.
- `app/(chat)/api/chat/route.ts` — `buildDelegationCapabilityAppendix`, `buildCompanionSystemPrompt` (hosted path); **compact/slim** local prompts in `lib/ai/slim-prompt.ts` may omit appendix by design — treat parity as optional (see Unit 3).
- `lib/ai/tools/delegate-to-openclaw.ts` — static `buildDelegateTaskToolDescription()`; skill enumeration at execute time when needed — companion appendix carries live ids for hosted path.
- Tests: `tests/unit/delegation-snapshot.test.ts`, `tests/unit/deployment-capabilities.test.ts`, `tests/unit/delegation-pending-route.test.ts`.

### Institutional Learnings

- None in `docs/solutions/` specific to this follow-up; prior truth lives in `docs/openclaw-bridge.md` and `docs/virgil-manos-delegation.md`.

### External References

- Skipped — contracts are defined in-repo.

## Key Technical Decisions

- **Treat prior plan as baseline:** No reinvention of R1–R3; this plan is **follow-through + operator procedure**.
- **One exemplar skill:** Prefer a **read-only, low-blast-radius** id (e.g. status/diagnostic) so smoke tests do not require destructive confirmations — exact name is operator choice; docs use a **placeholder** pattern (`your-skill-id`).
- **R7 optional:** Ship “one skill” runbook **without** blocking on a new settings subsection; add R7 only when design capacity exists.

## Open Questions

### Resolved During Planning

- **R5:** Failover-only — unchanged from [2026-04-19-003](2026-04-19-003-feat-delegation-capabilities-surface-plan.md).

### Deferred to Implementation

- **Chosen exemplar skill id and gateway** (Hermes-only vs OpenClaw vs in-app bridge) — operator picks during execution; docs stay generic.

## Implementation Units

- [x] **Unit 1: Verification sweep (automated + manual)**

**Goal:** Prove the shipped delegation surface is still correct after any concurrent repo changes.

**Requirements:** R1–R2 spot-check, R4 non-regression.

**Dependencies:** None.

**Files:**

- Run: `tests/unit/delegation-snapshot.test.ts`, `tests/unit/deployment-capabilities.test.ts`, `tests/unit/hermes-config.test.ts`, `tests/unit/delegation-provider.test.ts` (as applicable to touched areas)
- Skim: `lib/deployment/delegation-snapshot.ts`, `app/(chat)/api/deployment/capabilities/route.ts`

**Approach:** Run unit suites touching delegation; manual: signed-in `/deployment` with delegation env — confirm block shows primary, failover, reachability, skills, stale banner when forced offline; use **Refresh skills snapshot** and `?refresh=1` behavior.

**Test scenarios:**

- Happy path: existing unit tests pass unchanged.
- Regression: no new secrets in JSON responses (manual or existing assertions).

**Verification:** CI-green unit tests for delegation modules; manual checklist ticked in PR.

---

- [x] **Unit 2: Runbook — add one gateway skill (R6 + “bit of 1”)**

**Goal:** Operators can add **one** skill and see it in Virgil without spelunking code.

**Requirements:** R6, brainstorm “bit of 1”.

**Dependencies:** None (can parallel Unit 1).

**Files:**

- Modify: `docs/openclaw-bridge.md` — new subsection **“Adding a skill to the advertised list”** (or equivalent): register on gateway host, verify `GET` skills path, set `OPENCLAW_SKILLS_STATIC` if needed, restart if required, **Refresh** on `/deployment`, run safe `delegateTask`.
- Modify: `docs/virgil-manos-delegation.md` — short cross-link if production uses poll-primary or tunnel-only Hermes.
- Optional: `AGENTS.md` — one-line pointer to the new subsection under delegation.

**Approach:** Document **verification gates** aligned with UI: skill id appears in `deployment` list, `skillsStatus` is `ok` after refresh, then test delegate. Explicitly state skills are **not** implemented inside the Virgil repo.

**Test scenarios:**

- Test expectation: none — documentation only.

**Verification:** Another maintainer can follow the doc on a clean machine with only env vars and gateway access.

---

- [x] **Unit 3: Optional — slim/compact prompt parity for delegation appendix**

**Goal:** If local Ollama compact/slim prompts should mention delegation skill ids when delegation is configured, align `lib/ai/slim-prompt.ts` / `app/(chat)/api/chat/route.ts` with the hosted appendix pattern.

**Requirements:** R3 (only if product wants parity).

**Dependencies:** Unit 1 (understand current omission).

**Files:**

- Modify: `lib/ai/slim-prompt.ts`, `app/(chat)/api/chat/route.ts` (or equivalent call sites)
- Test: extend or add `tests/unit/slim-prompt*.test.ts` if exists

**Approach:** **Default outcome may be “no code change”** — if omission is intentional (token budget), document one sentence in `docs/openclaw-bridge.md` or `AGENTS.md`: *Local slim/compact prompts may not include the gateway skill appendix; use hosted chat or `/deployment` for the canonical list.*

**Test scenarios:**

- If implemented: compact path with delegation configured includes bounded skill sample or pointer.
- If documented-only: no test change.

**Verification:** Explicit decision recorded in PR description.

---

- [ ] **Unit 4: Optional — R7 minimal checklist (deployment page)**

**Goal:** Optional stretch from origin — env names checklist + links without secrets.

**Requirements:** R7.

**Dependencies:** Units 1–2.

**Files:**

- Modify: `components/deployment/capabilities-panel.tsx`
- Test: component or snapshot test if added

**Approach:** Short bullet list: Hermes URL set?, secret set off-loopback?, OpenClaw paths if used?, link to health routes — **only if** scope confirmed; otherwise skip and note “deferred” in PR.

**Test scenarios:**

- Happy path: checklist renders for authenticated user when delegation section visible.
- Test expectation: none — if unit skipped.

**Verification:** Product owner approval or explicit defer in PR.

---

- [ ] **Unit 5: End-to-end smoke (operator)**

**Goal:** Confirm **one** new skill id works through Virgil.

**Requirements:** “Bit of 1” acceptance.

**Dependencies:** Unit 2 (skill exists); Unit 1 (health).

**Files:**

- None required in-repo if smoke is manual; optional: add `docs/` troubleshooting line if a failure mode appeared.

**Approach:** After gateway registration: `GET /api/delegation/health` (or deployment capabilities) shows id → chat `delegateTask` with explicit `skill` → expect success or expected gated confirmation — document result in PR.

**Test scenarios:**

- Integration: manual only (LAN/tunnel dependent).

**Verification:** PR lists skill id used and outcome; no production secrets.

**Execution note (2026-04-20):** Unit 4 (R7 checklist UI) **deferred** — not required for runbook ship. Unit 5 remains **operator manual** when a gateway is available; no CI block.

## System-Wide Impact

- **Interaction graph:** Optional R7 touches only deployment UI; runbook changes are docs-only.
- **Error propagation:** Unchanged.
- **Unchanged invariants:** `delegationSendIntent`, strict allowlist, confirmation flows.

## Risks & Dependencies

| Risk | Mitigation |
|------|------------|
| Operator cannot reproduce skill registration | Unit 2 doc reviewed by second reader; placeholder ids |
| Flaky LAN/tunnel during smoke | Record environment assumptions; do not block merge on live smoke if CI is green |

## Documentation / Operational Notes

- Keep `docs/openclaw-bridge.md` and `docs/virgil-manos-delegation.md` in sync with any env renames in `lib/integrations/*-config.ts`.

## Sources & References

- **Origin document:** [docs/brainstorms/2026-04-19-hermes-openclaw-delegation-access-requirements.md](../brainstorms/2026-04-19-hermes-openclaw-delegation-access-requirements.md)
- **Prior completed plan:** [docs/plans/2026-04-19-003-feat-delegation-capabilities-surface-plan.md](2026-04-19-003-feat-delegation-capabilities-surface-plan.md)
- Related code: `lib/deployment/delegation-snapshot.ts`, `components/deployment/capabilities-panel.tsx`, `docs/openclaw-bridge.md`
