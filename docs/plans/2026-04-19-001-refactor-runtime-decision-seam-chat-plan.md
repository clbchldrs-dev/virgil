---
title: "refactor: Runtime decision seam (chat policy lane)"
type: refactor
status: active
date: 2026-04-19
origin: docs/brainstorms/2026-04-18-runtime-decision-seam-requirements.md
---

# refactor: Runtime decision seam (chat policy lane)

## Overview

Introduce an explicit **preflight runtime decision** for the **`chat` policy lane** that selects primary path, fallback ladder, and policy reasons **before** billable model work, emits a **versioned decision record** (non-blocking), and aligns in-flight failure handling with **bounded, resilient** recovery posture (see origin: `docs/brainstorms/2026-04-18-runtime-decision-seam-requirements.md`). v1.0 ships **chat-only** wiring; other policy lanes stub behind the same interface.

## Problem Frame

Today, model routing, fallback eligibility, planner gating, and stream setup interleave inside `app/(chat)/api/chat/route.ts` with supporting logic in `lib/ai/models.ts`, `lib/ai/chat-fallback.ts`, `lib/ai/model-routing.ts`, and providers. That layout makes incidents harder to reason about and duplicates “decision-shaped” facts across metrics (`lib/v2-eval/trace-log.ts` optional JSONL) and ad hoc branches. The seam centralizes **policy evaluation** and **decision artifacts** without rewriting the entire orchestrator in one step.

## Requirements Trace

| ID | Requirement (from origin) | Plan coverage |
|----|---------------------------|---------------|
| AC1 | Single runtime decision interface before `chat` execution; other lanes stub/no-op | IU1–IU3, sequencing |
| AC2 | In-flight failures classified; bounded recovery before terminal degrade | IU5 |
| AC3 | Decision records: schema version, trace correlation, non-blocking delivery classes | IU2, IU4 |
| AC4 | Explicit fallback policy with **hard caps** (attempts, latency, cost) — **resilient posture** | IU3, IU5; numeric caps deferred as assumptions table |
| AC5 | Standardized degraded-mode user messaging | IU6 |
| AC6 | Eval gate: deterministic routing/fallback/cost checks for `chat` | IU7 |
| AC7 | Rollout toggle for chat seam + stubbed lanes | IU4, IU8 |

## Scope Boundaries

- **In scope:** `chat` POST path (`app/(chat)/api/chat/route.ts`), shared types usable later by delegation/wiki policy lanes, policy table for paths already expressed via `lib/ai/chat-fallback.ts` + `lib/ai/models.ts`, extension of existing trace/interaction logging where appropriate.
- **Out of scope:** multi-agent planner redesign, new workflow engine, replacing Hermes/OpenClaw bridges, full wiki pipeline refactor, operator UI control plane (see origin out-of-scope list).

### Deferred to follow-on plans

- Onboarding **`delegation`** and **`wiki ops`** policy lanes after milestone gates.
- Choosing persistence sink beyond current JSONL / interaction log patterns (plan assumes “extend existing + document runbook” unless implementation discovers a hard gap).

## Context & Research

### Relevant code

- **Primary orchestrator:** `app/(chat)/api/chat/route.ts` — model resolution, `streamText`, fallback notices, telemetry (`logInteraction`, `logDecisionTrace`, `logChatPathTelemetryEvent`).
- **Fallback policy primitives:** `lib/ai/chat-fallback.ts` (`FallbackTier`, eligibility helpers, gateway vs Gemini vs Ollama signals).
- **Model IDs and local class:** `lib/ai/models.ts` (`resolveRuntimeModelId`, `getChatModelWithLocalFallback`, `isLocalModel`, etc.).
- **Auto model pre-resolution:** `lib/ai/model-routing.ts` (`resolveAutoChatModel` for `virgil/auto`).
- **Optional decision-shaped trace:** `lib/v2-eval/trace-log.ts` (`logDecisionTrace`, gated by `V2_TRACE_LOGGING`).
- **Telemetry / path logging:** `lib/reliability/chat-path-telemetry.ts`.
- **Prompt lane vocabulary (distinct from policy lanes):** `lib/ai/lanes.ts`.

### Institutional learnings

- `docs/solutions/` is absent; use `docs/STABILITY_TRACK.md`, `docs/DECISIONS.md`, and `docs/tickets/2026-04-18-v1-1-m4-reliability-observability-hardening.md` as posture references.

### External research

- Skipped for this plan; behavior is highly repo-specific and prior ideation already incorporated operator-runbook patterns.

## Key Technical Decisions

1. **Pure preflight module first:** introduce `resolveChatRuntimeDecision(...)` (name TBD) that returns an immutable **decision object** + **human-readable reasons** without side effects beyond optional cheap reachability checks already used today (`assertOllamaReachable` patterns) — any new probe must respect explicit **latency budget** called out in the decision record.
2. **Feature-flag cutover:** `VIRGIL_RUNTIME_DECISION_SEAM` (or reuse an existing flags pattern from `lib/flags/` if present) supports **shadow → authoritative** without a big-bang switch; default off in production until eval baseline passes.
3. **Resilient caps as planning assumptions** (refine in implementation with metrics): e.g. max **N** automatic tier transitions per request, max wall-clock **T** ms in preflight+retry envelope, max **cost proxy** steps (model tier ordering) — numbers live in one config object reviewed with STABILITY_TRACK.
4. **Decision record delivery:** start by **extending** `logDecisionTrace` / interaction log fields so operators have one documented JSON path; avoid new databases in v1.0 unless flight-deck Postgres work already landed a suitable table (re-check `docs/plans/2026-04-18-001-feat-operator-flight-deck-mvp-plan.md` before adding a second persistence story).
5. **In-flight classification:** narrow v1.0 scope to **pre-stream** failures + first `streamText` error classification reusing `isFallbackEligibleError` / `isGatewayFallbackEligibleError` families before adding a full stream state machine.

## Assumptions (until measured)

| Assumption | Rationale |
|------------|-----------|
| Resilient posture allows **2–3** tier transitions max per chat turn under failure pressure | Origin “resilient” choice; tighten using `chat-fallback` telemetry after shadow period |
| Preflight probes add **< 200ms** p95 budget on hot path when Ollama check is already required | Avoid duplicating full discovery; align with existing `assertOllamaReachable` usage |
| Trace correlation reuses existing **chatId** + request id already threaded through route | No new distributed trace ID scheme in v1.0 unless OTel work precedes |

## Implementation Units

### IU1 — Decision types and schema version

- Add shared types: policy lane id (`chat` | stub), path enum, fallback ladder, caps snapshot, `DecisionPhase`, delivery class.
- Export `DECISION_SCHEMA_VERSION` constant.
- **Tests:** `tests/unit/runtime-decision-schema.test.ts` — serialization round-trip, version monotonicity guard.

### IU2 — `resolveChatRuntimeDecision` (preflight, side-effect minimal)

- Inputs: authenticated user context, `selectedChatModel`, env flags, results of any allowed probes (inject `OllamaReachableResult` for testing).
- Outputs: primary model id, effective prompt variant, fallback sequence, structured `reasonCodes[]`, `caps` snapshot.
- Reuse logic from `resolveRuntimeModelId`, `getChatModelWithLocalFallback`, `resolveAutoChatModel`, `getFallbackTiers` / helpers in `chat-fallback.ts` — **move decision ordering into this function** rather than duplicating rules.
- **Tests:** `tests/unit/runtime-decision-chat.test.ts` — matrix: gateway healthy, gateway 429, Ollama configured/unconfigured, `virgil/auto`, auth-failure no-mask cases per `isGatewayAuthFailureError`.

### IU3 — Policy table as typed rule rows

- Encode “stable mode” defaults as data (small array of rules with predicates) to satisfy origin “typed in-code rule table (no DSL)”.
- **Tests:** same file or `tests/unit/runtime-decision-policy-table.test.ts` — each rule fires independently; forbidden transitions (auth failure → Ollama) remain impossible.

### IU4 — Shadow mode in `app/(chat)/api/chat/route.ts`

- Behind flag: compute seam decision, compare to legacy “effective path” choice, **log divergence** via `logChatPathTelemetryEvent` or dedicated metric without changing behavior.
- **Tests:** `tests/unit/chat-route-runtime-decision-shadow.test.ts` using route handler extraction patterns (if route is too heavy, test via extracted helper called by route).

### IU5 — Authoritative preflight + bounded in-flight handling

- Flag on: route **must** use seam outputs for model + prompt variant + initial fallback plan.
- Wrap `streamText` error handling so classification increments **attempt counters** against `caps` and stops with terminal degrade + standardized user message class.
- **Tests:** `tests/unit/chat-fallback.test.ts` and `tests/unit/chat-gateway-fallback-errors.test.ts` extended or parallel file for “seam + stream” golden cases; keep fixtures in existing style.

### IU6 — Degraded-mode UX mapping

- Central map: `reasonCodes` + terminal class → stream `data-*` chunks / copy already used (`data-fallback-notice` pattern in route).
- Document classes: `transient`, `quota`, `policy_blocked`, `dependency_down`, `unknown` (per origin).
- **Tests:** `tests/unit/chat-error-display.test.ts` or new `tests/unit/runtime-decision-degraded-ux.test.ts` for message class selection.

### IU7 — Eval gate wiring

- Add deterministic fixtures under `tests/unit/` (and optionally `tests/e2e/chat.test.ts` smoke) proving AC6: routing, fallback, cost-proxy ordering regressions.
- Wire into `pnpm stable:check` only if runtime < budget; otherwise document manual CI gate until stabilized.

### IU8 — Rollout and documentation

- Env table row in `docs/` (operator-facing): flag semantics, shadow vs authoritative, where to read decision JSON.
- Update `docs/STABILITY_TRACK.md` or linked ticket with milestone checkbox when AC satisfied.

## Sequencing

1. IU1 → IU2 → IU3 (foundation)
2. IU4 (shadow) — run in staging with real traffic subset
3. IU5 + IU6 (authoritative + UX) — enable for internal dogfood
4. IU7 (eval hardening) — gate production default
5. IU8 (docs + rollout)

## Risks

| Risk | Mitigation |
|------|------------|
| Route file grows further during migration | Extract **only** decision blocks into `lib/ai/runtime-decision/` modules; avoid drive-by refactors |
| Shadow/authoritative drift | CI fails on divergence rate > threshold in fixture suite |
| Double Ollama probes | Seam owns reachability result; route passes cached probe outcome into `streamText` path |

## Open Questions (carried from origin)

- **Q1** Second policy lane after `chat` — unchanged; not blocking chat seam implementation.
- **Q3** Static vs rolling cost — deferred; seam uses **tier ordering** first; rolling signals attach later without schema break if fields are optional.

## Next Steps

- Execute with `/ce:work` (or ad-hoc implementation) following IU order; keep PRs per IU where possible.
- After implementation stabilizes, return to brainstorm only if product scope shifts materially.
