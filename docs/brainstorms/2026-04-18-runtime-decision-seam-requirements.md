# Runtime Decision Seam Requirements (Virgil 1.1 -> v1.0)

Dates: **2026-04-18** (initial draft), **2026-04-19** (continuation — terminology + codebase alignment)  
Status: Draft (brainstorm output)  
Scope level: Standard/Deep  
Related context: `docs/ideation/2026-04-18-open-ended-repo-improvements.md`, `docs/STABILITY_TRACK.md`, `docs/tickets/2026-04-18-v1-1-m4-reliability-observability-hardening.md`

## Problem statement

Virgil's runtime path selection (hosted-first, local fallback, delegation paths, and feature-flag branches) is distributed across multiple decision points. This creates three v1.0 risks:

1. Routing behavior is difficult to explain and reproduce during incidents.
2. Cost behavior is hard to predict before token spend starts.
3. Reliability outcomes vary by path in ways that are not visible early enough.

The result is avoidable operator ambiguity during degraded states, plus slower iteration because behavior is inferred from code/log spelunking instead of one explicit decision record.

**Verified today (codebase, shallow):** early routing for `virgil/auto` is already centralized in `lib/ai/model-routing.ts` (`resolveAutoChatModel`); optional **decision-shaped** telemetry exists as `logDecisionTrace` in `lib/v2-eval/trace-log.ts` (gated by `V2_TRACE_LOGGING`, append-only JSONL under `workspace/v2-eval/`). The **chat** path still folds model choice, fallback tiers, planner eligibility, and stream setup in **`app/(chat)/api/chat/route.ts`** — the seam’s job is to **replace implicit interleaving** with one explicit preflight decision + record, not to ignore these pieces.

## Definitions

- **Policy lane (seam):** product surface where the runtime decision seam runs first — this document uses **`chat`**, **`delegation`**, and **`wiki ops`** for policy and rollout language.
- **Prompt / delegation lane (`VIRGIL_LANE_IDS`):** companion prompt mental model in code — **`chat`**, **`home`**, **`code`**, **`research`** (`lib/ai/lanes.ts`). It is **not** the same enum as policy lanes; planning must map between them.

### Policy lane ↔ prompt lane mapping (working)

| Policy lane (seam) | Primary prompt lane(s) | Notes |
|--------------------|-------------------------|--------|
| `chat` | `chat` | Primary v1.0 milestone; `app/(chat)/api/chat/route.ts` is the heavy runtime orchestrator today. |
| `delegation` | `home` (+ bridge tools) | Hermes / OpenClaw, `delegateTask`, LAN execution; not a separate `VIRGIL_LANE_ID`. |
| `wiki ops` | `research` + wiki maintenance | Fetch/embed/wiki config (`VIRGIL_WIKI_*`), `embedViaDelegation` when enabled; may span routes beyond a single handler. |

- **Decision record / decision artifact:** used interchangeably in this doc — the structured object emitted per request (or phase) for trace and policy, regardless of storage sink.
- **Hermes / OpenClaw:** LAN-side delegation bridges for `home`-lane tools (see `docs/openclaw-bridge.md`, `docs/virgil-manos-delegation.md`); not separate policy lane IDs.
- **Workflow-first:** product sequencing discipline (eval- and stability-gated rollout), **not** “adopt a third-party workflow engine” — see `docs/DECISIONS.md` (Ghost of Virgil ADR). New Temporal/Hatchet-class workflow engines remain out of scope for this initiative (see **Out of scope** below).

- **Path:** provider/runtime choice inside a policy lane (hosted gateway, direct Gemini, Ollama local, delegation bridge, etc.).
- **Route handler:** HTTP/API entrypoint implementation detail.
- **Scoped policy lanes (v1.0 milestone):** **`chat` only** for the first seam cutover. **`delegation`** and **`wiki ops`** follow behind milestone gates; **second policy lane after `chat` is not fixed in this doc** (see Open questions — owner indicated a choice outside the default menu during brainstorm; confirm at planning kickoff).

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

Add one policy gate with a **shared decision schema** (and room for lane overrides) for core policy lanes (`chat`, `delegation`, `wiki ops`), with eval gating. **v1.0 ships wiring for `chat` only**; the other policy lanes consume the same types/interfaces behind readiness gates so Option B does not imply shipping delegation/wiki seam logic on the v1.0 date.

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

**v1.0 measurement scope:** the scorecard below is **proven on the `chat` policy lane** for the v1.0 milestone. Claims that implicitly depend on `delegation` / `wiki ops` behavior **apply only after** those lanes are onboarded behind their gates — not as v1.0 exit criteria unless explicitly extended later.

### Reliability

- Increase successful completion rate on **`chat`** under representative failure scenarios (hosted, gateway fallback, Ollama local where configured).
- Reduce "unclassified failure" incidents where no clear routing/fallback reason is available.
- Improve useful degraded outcomes (actionable fallback/degrade response instead of hard failure) for **`chat`**.

### Cost

- Reduce avoidable high-cost path selections for requests that qualify for cheaper safe paths.
- Bound fallback escalation so retries do not create uncontrolled spend bursts.

### Controllability

- Every routed **`chat`** request has a traceable decision record (same schema reserved for future policy lanes).
- Operators can answer "why this path?" and "what fallback was attempted?" without code inspection.
- Operators can retrieve decision context through documented steps in under 5 minutes (exact sink and runbook path are **for planning to fix** — today only optional `logDecisionTrace` JSONL exists).

## Acceptance criteria for v1.0 seam milestone

1. A single runtime decision interface is invoked **before execution for every `chat` request**; other policy lanes may **stub or no-op** behind the same interface for flags and blast-radius isolation until onboarded.
2. In-flight failures are classified and routed through bounded recovery rules before terminal degrade.
3. Decision records are emitted with schema versioning, trace correlation, and non-blocking delivery semantics.
4. Fallback policy is explicit and testable with hard caps for max attempts, max latency budget, and max cost budget per request.
5. Degraded-mode user messaging is standardized for policy-triggered fallback/failure, using existing surfaces.
6. Eval gate for v1.0 includes minimum deterministic checks for routing correctness, fallback correctness, and cost-governance regressions on `chat`.
7. Rollout can be toggled **for the `chat` seam** (and for stubbed future lanes) without changing unrelated runtime behavior (validated by blast-radius checks on shared resources).

## Risks and mitigations

- **Risk:** Hidden edge-path divergence during migration.
  - **Mitigation:** Shadow mode or dual-logging period before default cutover (**strongly recommended** pre-requisite for first production cutover; planning should name duration and comparison signals even if it stays out of the formal AC list).

- **Risk:** Policy complexity regrows into branching sprawl.
  - **Mitigation:** Keep rule set small; add admission checks for new policy branches.

- **Risk:** Team over-invests in control-plane UX before seam stability is proven.
  - **Mitigation:** Gate additional operator UX behind seam acceptance criteria completion.

- **Risk:** Decision record emission failures create blind spots during incidents.
  - **Mitigation:** Define delivery classes and monitor dropped-record rate with alert threshold.

## Open questions

1. **Second policy lane after `chat`:** confirm ordering (`delegation` vs `wiki ops` vs `code`-adjacent surfaces, or a split not listed here). *Brainstorm 2026-04-19: respondent selected an option outside the provided menu — capture the explicit second priority at `/ce:plan` kickoff.*
2. **Fallback depth and caps (partially resolved):** default posture is **resilient** — prefer completing the user’s task within a **generous but still bounded** envelope (attempt count, wall-clock latency, and cost budget **all capped**) before mandatory user-visible degrade. **Exact numeric caps remain for planning** after profiling real failure modes (gateway, Ollama, delegation) against `docs/STABILITY_TRACK.md` constraints.
3. Should v1.0 use static cost tiers only, or include rolling-spend signals with freshness guarantees?

## Planning readiness

### Resolve Before Planning

- *(empty — no single product choice blocks opening a plan doc, provided planning records assumptions for open questions 1–3.)*

### Deferred to Planning

- **[User decision][Q1]** Second policy lane priority after `chat` (owner to state explicitly at kickoff).
- **[Technical][Q2]** Numeric caps: translate the **resilient** posture into concrete max attempts, wall-clock budget, and cost budget per request (posture chosen 2026-04-19; numbers still open).
- **[Needs research][Q3]** Static cost tiers vs rolling-spend signals and acceptable staleness if rolling is chosen.
- **[Technical]** Persistence and redaction for decision records (sink, retention, PII) to substantiate the “under 5 minutes” operator retrieval bar.
- **[Technical]** Inventory of chat failure/exit paths for degraded-mode UX (criterion 5) so copy work is bounded.

## Proposed next step

Run `/ce:plan` for **Option B** with a phased delivery plan:

1. Decision schema + seam interface
2. Chat lane cutover + eval baseline
3. Delegation/wiki lane onboarding
4. Rollout gates + operator runbook updates
