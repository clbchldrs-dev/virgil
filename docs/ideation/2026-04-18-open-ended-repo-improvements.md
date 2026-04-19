# Ideation: highest-leverage repo improvements

Date: 2026-04-18  
Scope: Open-ended ideation for the `virgil` repository (repo-grounded)

## Grounding used

- **Codebase context:** Next.js + TypeScript app with hosted-primary AI path, local Ollama resilience, dense ops/docs/config surface, and v1.1 -> stable v1.0 stabilization goals.
- **Past learnings context:** `docs/solutions/` was not present; nearest institutional guidance came from `docs/DECISIONS.md`, `docs/STABILITY_TRACK.md`, `docs/ENHANCEMENTS.md`, `docs/V1_V2_RISK_AUDIT.md`, and `docs/PRUNING_CANDIDATES.md`.
- **External context:** Prior art converged on workflow-first design, strong tool schemas, checkpoint/resume durability, evaluation-gated rollout, and decision-time guidance over larger static prompts.
- **Slack context:** Not included (available on request).

## Funnel

- Raw candidates generated: **42** (6 ideation frames x 7 each)
- Cross-cutting combinations added: **3**
- Survivors after adversarial filtering: **6**

Filtering criteria:
- Compounding leverage across multiple problem areas
- Alignment with v1.0 stabilization (reliability, predictability, operator clarity)
- Feasibility for a small/solo team without large infra expansion
- Clear distinction from existing docs/work (not just relabeling current initiatives)

## Ranked survivors

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

Use `ce:brainstorm` on one survivor to convert it into concrete requirements and boundaries before planning.  
Best candidate to start: **Runtime decision seam (single policy gate)**.
