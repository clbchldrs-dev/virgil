# Runtime Decision Seam Requirements (Virgil 1.1 -> v1.0)

Date: 2026-04-18  
Status: Draft (brainstorm output)  
Scope level: Standard/Deep  
Related context: `docs/ideation/2026-04-18-open-ended-repo-improvements.md`, `docs/STABILITY_TRACK.md`, `docs/tickets/2026-04-18-v1-1-m4-reliability-observability-hardening.md`

## Problem statement

Virgil's runtime path selection (hosted-first, local fallback, delegation paths, and feature-flag branches) is distributed across multiple decision points. This creates three v1.0 risks:

1. Routing behavior is difficult to explain and reproduce during incidents.
2. Cost behavior is hard to predict before token spend starts.
3. Reliability outcomes vary by path in ways that are not visible early enough.

The result is avoidable operator ambiguity during degraded states, plus slower iteration because behavior is inferred from code/log spelunking instead of one explicit decision record.

## Definitions

- **Lane:** product domain (`chat`, `delegation`, `wiki ops`).
- **Path:** provider/runtime choice inside a lane.
- **Route handler:** HTTP/API entrypoint implementation detail.
- **Scoped lanes (v1.0 milestone):** `chat` only. `delegation` and `wiki ops` are follow-on onboarding lanes after milestone gates pass.

## Desired outcome

Introduce one explicit runtime decision seam that evaluates request context before model/tool execution and produces a structured decision record that can be traced, tested, and policy-governed.

This seam should improve:

- Reliability: fewer dead-end runs and clearer retry/degrade behavior.
- Cost control: fewer expensive misroutes and clearer fallback policy.
- Controllability: deterministic, inspectable routing choices.

## Users and jobs-to-be-done

- Operator/owner: "When chat/delegation behaves unexpectedly, I can quickly see why a path was chosen and what fallback policy applied."
- Product maintainer: "I can change routing policy in one place and verify impact with lane evals."
- End user: "When something fails, Virgil degrades predictably and communicates what's happening."

## In-scope capabilities

1. **Pre-execution routing decision**
   - One decision pass before any billable model call or remote delegation execution.
   - Lightweight health checks are allowed and must be recorded in the decision artifact.
   - Chooses runtime path (primary + fallback policy) from known, bounded options.

2. **In-flight reliability checkpoint**
   - Runtime failures after stream/execution start are classified and recorded (`preflight`, `inflight`, `terminal`).
   - Recovery remains bounded by explicit latency/cost/attempt limits, then transitions to terminal degraded-mode behavior.

3. **Structured decision record**
   - Every request in scoped lanes emits a machine-readable decision artifact with:
   - selected path
   - fallback sequence
   - policy reason(s)
   - guardrail trigger(s) if any
   - decision phase (`preflight`, `inflight`, `terminal`)
   - decision schema version
   - trace correlation id
   - record delivery status (`durable`, `best_effort`, `dropped`)
   - Records are non-blocking for request flow and queryable through existing logs/traces with a documented lookup path.

4. **Policy-first controls**
   - Path selection logic is configured as policy rules rather than hidden branch interactions.
   - v1.0 policy mechanism is a typed in-code rule table (no DSL, no remote dynamic policy engine).
   - Policy supports "stable mode" behavior for v1.0 (predictable over clever).

5. **Degraded-mode UX contract**
   - User-facing response behavior is standardized when the selected primary path cannot proceed.
   - Degraded responses map to explicit classes (`transient`, `quota`, `policy_blocked`, `dependency_down`, `unknown`).
   - Messaging is concise, actionable, and consistent.

6. **Eval and release gates**
   - Lane-level eval checks validate that decision behavior remains within thresholds before enabling wider rollout.

## Out of scope (this phase)

- Multi-agent orchestration redesign.
- New workflow engine adoption (Temporal/Hatchet/Honcho-level runtime migration).
- Broad v2 architecture migration.
- Replacing all existing route handlers; only decision entry and interfaces are required for v1.0.

## Approach options

### Option A: Minimal seam (fast stabilization)

Add a central decision gate for chat runtime only, with structured decision records and basic fallback policy.

Pros:
- Fastest path to production signal.
- Low migration risk.
- Immediate observability win.

Cons:
- Delegation/wiki paths remain partially fragmented.
- Smaller leverage on cross-lane consistency.

Best when:
- Primary goal is immediate stabilization for the highest-volume path.

### Option B: Lane-aware seam (recommended)

Add one policy gate used by core lanes (`chat`, `delegation`, `wiki ops`) with shared decision schema, lane overrides, and eval gating.

Pros:
- Strong reliability/controllability improvements without overbuilding.
- Creates one governance surface for cost + fallback policy.
- Aligns with workflow-first, lane-gated progression.

Cons:
- Higher integration effort than Option A.
- Requires lane-specific eval baseline work.

Best when:
- Goal is balanced reliability + cost + controllability for v1.0.

v1.0 boundary:
- Must ship `chat` lane seam milestone first.
- `delegation` and `wiki ops` move behind post-milestone readiness gates and must not delay v1.0 stabilization.

### Option C: Full control plane now

Build a near-complete operator decision control plane (full profile system, broad config compilation, deep diagnostics UI coupling) as part of seam rollout.

Pros:
- Highest long-term architecture coherence.
- Strong operator ergonomics if fully finished.

Cons:
- Highest schedule and scope risk for v1.0.
- Greater chance of stabilization delay.

Best when:
- Team can absorb larger foundational work before release pressure.

## Recommendation

Choose **Option B (lane-aware seam)**.

Why:
- It is the highest-leverage path that still fits v1.0 stabilization constraints.
- It converts routing from implicit branching into explicit policy with inspectable outcomes.
- It directly supports eval-gated release discipline without forcing a control-plane rewrite.

## Success criteria (balanced scorecard)

### Reliability

- Increase successful completion rate on targeted lanes under representative failure scenarios.
- Reduce "unclassified failure" incidents where no clear routing/fallback reason is available.
- Improve useful degraded outcomes (actionable fallback/degrade response instead of hard failure) for scoped lanes.

### Cost

- Reduce avoidable high-cost path selections for requests that qualify for cheaper safe paths.
- Bound fallback escalation so retries do not create uncontrolled spend bursts.

### Controllability

- Every routed request in scoped lanes has a traceable decision record.
- Operators can answer "why this path?" and "what fallback was attempted?" without code inspection.
- Operators can retrieve decision context through documented steps in under 5 minutes.

## Acceptance criteria for v1.0 seam milestone

1. A single runtime decision interface is used by scoped lanes before execution.
2. In-flight failures are classified and routed through bounded recovery rules before terminal degrade.
3. Decision records are emitted with schema versioning, trace correlation, and non-blocking delivery semantics.
4. Fallback policy is explicit and testable with hard caps for max attempts, max latency budget, and max cost budget per request.
5. Degraded-mode user messaging is standardized for policy-triggered fallback/failure, using existing surfaces.
6. Eval gate for v1.0 includes minimum deterministic checks for routing correctness, fallback correctness, and cost-governance regressions on `chat`.
7. Rollout can be toggled by lane without changing unrelated runtime behavior (validated by blast-radius checks on shared resources).

## Risks and mitigations

- **Risk:** Hidden edge-path divergence during migration.
  - **Mitigation:** Shadow mode or dual-logging period before default cutover.

- **Risk:** Policy complexity regrows into branching sprawl.
  - **Mitigation:** Keep rule set small; add admission checks for new policy branches.

- **Risk:** Team over-invests in control-plane UX before seam stability is proven.
  - **Mitigation:** Gate additional operator UX behind seam acceptance criteria completion.

- **Risk:** Decision record emission failures create blind spots during incidents.
  - **Mitigation:** Define delivery classes and monitor dropped-record rate with alert threshold.

## Open questions

1. Which lane should cut over first after chat: delegation or wiki ops?
2. What fallback depth and latency/cost caps are acceptable before user-visible degrade is mandatory?
3. Should v1.0 use static cost tiers only, or include rolling-spend signals with freshness guarantees?

## Proposed next step

Run `ce:plan` for **Option B** with a phased delivery plan:

1. Decision schema + seam interface
2. Chat lane cutover + eval baseline
3. Delegation/wiki lane onboarding
4. Rollout gates + operator runbook updates
