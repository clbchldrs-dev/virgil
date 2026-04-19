# Ideation: highest-leverage repo improvements

Dates: **2026-04-18** (first pass), **2026-04-19** (continuation)  
Scope: Open-ended ideation for the `virgil` repository (repo-grounded)

## Grounding used (first pass, 2026-04-18)

- **Codebase context:** Next.js + TypeScript app with hosted-primary AI path, local Ollama resilience, dense ops/docs/config surface, and v1.1 -> stable v1.0 stabilization goals.
- **Past learnings context:** `docs/solutions/` was not present; nearest institutional guidance came from `docs/DECISIONS.md`, `docs/STABILITY_TRACK.md`, `docs/ENHANCEMENTS.md`, `docs/V1_V2_RISK_AUDIT.md`, and `docs/PRUNING_CANDIDATES.md`.
- **External context:** Prior art converged on workflow-first design, strong tool schemas, checkpoint/resume durability, evaluation-gated rollout, and decision-time guidance over larger static prompts.
- **Slack context:** Not included (available on request).

---

## Continuation (2026-04-19)

### Grounding used (rerun)

- **Codebase context:** Next.js + TypeScript monolith-style layout (`app/`, `lib/`, `components/`) with sibling surfaces `digital-self/`, `sophon/`, `workspace/`; composite runtime (Vercel + LAN + Hermes/OpenClaw + background jobs); `pnpm stable:check` as stabilization bar; pain concentrated in **subpackage contract/env drift**, **integration/quota/reachability under-automation vs unit/typecheck**, and **scattered observability** vs a unified operator trust story. New scan angles: cross-surface contract CI, quota/degradation harness, ingest as versioned pipeline boundary, packaging/desktop “appliance” path.
- **Past learnings context:** `docs/solutions/` still absent; same adjacent docs as first pass apply.
- **External context:** 2026 operator runbooks (run receipts, blast-radius containment, five-layer debugging), **decision-node transparency** (not log dumps), OTel **gen-ai semantic conventions** (incl. MCP alignment), **authorize vs capture** for tool side effects, **degraded control laws** when falling back, policy-as-prompt research signals.
- **Slack context:** Not included (available on request).

### Funnel (continuation pass)

- Raw candidates merged: **~53** (6 frames × ~8 ideas, plus **5** cross-cutting combinations; deduped clusters noted in scratch `raw-candidates.md`)
- Survivors after adversarial filtering: **7** (new ideas only; first-pass survivors retained below for reference)

Continuation filtering criteria (same spirit as first pass, plus): **must not duplicate** the six first-pass survivors except as complementary mechanism; prefer **integration/observability/operator-trust** leverage that the first pass named at a high level but did not spell as executable patterns.

### Ranked survivors (continuation — 2026-04-19)

#### 1) Integration trust stack (spine-first + consumer contracts + contract-smoke CI)

**Description:** Treat a small set of golden paths (hosted → tool → persistence; Ollama fallback; delegation hop) as **contract suites** that must pass before release. The main Next app owns **consumer-driven** fixtures/tests for each sibling package’s minimal surface (types, env keys, error shapes, wire formats). Add a **contract-smoke** CI lane that exercises boundary shapes with stubs or recorded fixtures before full Playwright.

**Rationale:** Directly targets “green unit/typecheck, red reality” and **digital-self / sophon / workspace drift** without waiting on a full flight-deck product.

**Downsides:** Fixture maintenance cost; secrets and environment matrix for probes; risk of flaky jobs if boundaries are too wide.

**Confidence:** 82%  
**Complexity:** Medium  
**Status:** Unexplored

#### 2) Decision-epoch receipt protocol (stream + OTel-aligned)

**Description:** Introduce **epochs** at non-obvious branches (model route, lane change, tool admission, fallback tier, delegation handoff). Emit compact **structured receipts** (inputs summary, rule id, outcome, next state) keyed by `epoch_id`, attached to traces with **OpenTelemetry gen-ai**-aligned attributes and optionally surfaced on the streaming/API protocol—not stdout spam.

**Rationale:** Unifies “run receipts,” transparency-at-decision-nodes, and operator postmortems into **one artifact class** consumable by UI and ops.

**Downsides:** Cross-cutting schema work; PII/redaction; streaming protocol versioning.

**Confidence:** 78%  
**Complexity:** Medium–High  
**Status:** Unexplored

#### 3) Mutating-tool lifecycle standard (authorize / capture + idempotency)

**Description:** Default pattern for mutating tools: **authorize** (plan + risk class + resource ids) then **capture** (execute), with **idempotency keys** and metrics for authorize-without-capture. Roll out via lint/branded types/codegen with a gradual exception list.

**Rationale:** Complements the first pass **schema-first registry** by hardening **execution semantics** under retries, bridges, and cheaper local models.

**Downsides:** Migration cost across existing `lib/ai/tools/*`; temporary two-speed codebase.

**Confidence:** 80%  
**Complexity:** High  
**Status:** Unexplored

#### 4) Failure-mode catalog + synthetic cross-surface probe + in-repo ladder playbooks

**Description:** Maintain a **closed set** of named degraded modes (for example LAN unreachable, quota soft, delegation stale, tool side-effect blocked) with **severity ladder** steps, **synthetic probe** coverage, and **versioned playbooks** colocated in the repo (not orphaned Notion).

**Rationale:** Converts external “incident ladder” guidance into **repo-enforced operator language** and honest integration signal before building a full console.

**Downsides:** Taxonomy quality matters; probes must avoid destructive prod effects.

**Confidence:** 76%  
**Complexity:** Medium  
**Status:** Unexplored

#### 5) OTel span-recipe codegen from tool metadata

**Description:** From each tool file’s declared metadata (name, side-effect class, dependency tags), generate consistent span names, gen-ai semconv attributes, and standard child spans for retries and delegation hops.

**Rationale:** Observability quality **compounds with tool count**; reduces bespoke tracing drift across Hermes/OpenClaw/Ollama.

**Downsides:** Codegen maintenance; semconv still evolving (stability opt-in discipline required).

**Confidence:** 74%  
**Complexity:** Medium  
**Status:** Unexplored

#### 6) Warm-path integration fixture library (quota / reachability aware)

**Description:** One shared library of **skippable** integration probes with explicit skip reasons (missing key, LAN down, quota exceeded) reused by CI, cron, and optional `stable:check` extensions—single vocabulary for “degraded but honest green.”

**Rationale:** Pairs with the failure-mode catalog and integration spine; avoids one-off flaky tests per route.

**Downsides:** Normalizing skip semantics across laptop vs Vercel; secret handling.

**Confidence:** 79%  
**Complexity:** Medium  
**Status:** Unexplored

#### 7) Trust half-lives for health and eval signals

**Description:** Attach **decay** to trust signals (reachability, bridge health, eval scores): confidence decreases unless refreshed by probes or receipts; operator views show **staleness**, not eternal green from last week.

**Rationale:** Tackles **false calm** after stale checks; distinct from “more dashboards.”

**Downsides:** Threshold tuning and UX copy—can feel noisy if miscalibrated.

**Confidence:** 68%  
**Complexity:** Medium  
**Status:** Unexplored

### Continuation rejection summary (representative)

| Rejected cluster / idea | Reason |
|-------------------------|--------|
| Metaphor-first concepts (mycorrhizae, START triage, pure theater framing) | Weak mechanism vs ops value; easy slide into narrative-only work. |
| WASM edge-only execution, 8h LLM “synthetic customer,” red-team-only release gate | Cost, flakiness, or release posture misaligned with small/solo maintainer reality. |
| “Receipts replace dashboards” | False dichotomy; receipts should augment queryable metrics. |
| Full CAS prompt store, revocable-cloud default witness | Large migration or extreme product risk for v1.0 window. |
| Duplicate variants of first-pass themes | Intentionally filtered to preserve distinct continuation value. |

Scratch checkpoints (same machine): OS temp `compound-engineering/ce-ideate/f4c85c14/` contains `raw-candidates.md`, `survivors.md`, and `web-research-cache.json`.

---

## Funnel (first pass, 2026-04-18)

- Raw candidates generated: **42** (6 ideation frames x 7 each)
- Cross-cutting combinations added: **3**
- Survivors after adversarial filtering: **6**

Filtering criteria:
- Compounding leverage across multiple problem areas
- Alignment with v1.0 stabilization (reliability, predictability, operator clarity)
- Feasibility for a small/solo team without large infra expansion
- Clear distinction from existing docs/work (not just relabeling current initiatives)

## Ranked survivors (first pass, 2026-04-18)

### 1) Runtime decision seam (single policy gate)
Create one explicit runtime decision layer that selects hosted path, local path, or fallback before token spend, with structured decision records.

Why this survives:
- Unifies reliability + cost + explainability in one leverage point.
- Removes hidden branching behavior currently spread across execution paths.
- Enables clean policy evolution without rewriting chat orchestration internals.

### 2) Schema-first tool contract registry with admission gates
Move tool definitions to a canonical versioned registry with typed contracts, validators, failure envelopes, and activation gates (contract checks + eval checks).

Why this survives:
- Prior art and repo learnings both point to tool contract quality as a reliability multiplier.
- Reduces docs drift, runtime ambiguity, and operator debugging complexity.
- Supports both hosted and local paths consistently.

### 3) Eval-gated capability lanes
Define explicit lanes (chat core, delegation, proactive nudges, wiki ops) and require lane-specific eval pass criteria before promotion to default-on behavior.

Why this survives:
- Turns “stabilization” from narrative into enforceable release discipline.
- Preserves iteration speed by isolating risk to lane boundaries.
- Directly supports STABILITY_TRACK-style evidence-based readiness.

### 4) Operator flight deck (diagnostics -> action)
Build a single operator console that surfaces fallback rates, error classes, queue health, cost burn, and recommended remediation steps with one-click/runbook actions.

Why this survives:
- Converts instrumentation from passive logs to practical incident response.
- Targets current friction: high documentation/config gravity and operational ambiguity.
- Improves trust during degraded states without adding model complexity.

### 5) Checkpoint/resume kernel for long-running workflows
Introduce durable checkpointing for long, tool-heavy, or delegated tasks so interrupted runs can resume deterministically with preserved intent and state.

Why this survives:
- High reliability payoff for real-world interruptions and partial failures.
- Matches strong external production patterns.
- Enables safer future proactive/agentic behavior without all-or-nothing execution.

### 6) Config intent profiles (replace env sprawl)
Replace broad toggle surfaces with validated operator profiles (for example stable, cost-saver, debug) that compile to safe, tested config bundles.

Why this survives:
- Reduces operator cognitive overhead and misconfiguration risk.
- Reinforces predictable behavior under v1.0 stabilization constraints.
- Keeps flexibility while cutting accidental complexity.

## Ideas rejected (cluster-level reasons)

- **Mostly duplicative variants** of flight deck/triage/control-plane ideas without additional mechanism.
- **Prematurely broad product pivots** (for example default local-first inversion) that may conflict with hosted-primary intent unless validated through strict policy controls.
- **Metaphor-only proposals** (cross-domain framing with weak implementation detail).
- **Low-novelty restatements** of existing documented priorities without new execution leverage.

## Suggested next move

Use `ce:brainstorm` on **one** survivor to convert it into concrete requirements and boundaries before planning.

Reasonable starters:

- **First pass:** **Runtime decision seam (single policy gate)** — still the cleanest unifying policy story.
- **Continuation:** **Integration trust stack** or **Decision-epoch receipt protocol** — both are concrete, cross-cutting, and complementary to the first-pass list without replacing it.
