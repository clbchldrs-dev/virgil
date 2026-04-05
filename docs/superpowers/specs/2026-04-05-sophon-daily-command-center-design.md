# Sophon Daily Command Center Design (Option B v1)

## Workspace Home

Sophon implementation lives in `sophon/` at the repository root.

## Goal

Build the first Sophon slice as a digital clone for life management that prioritizes:

1. reducing task demand while increasing task clarity,
2. maintaining accountability as habits get stale,
3. proactively drafting plans and suggestions from a priority matrix,
4. preserving calm through full-context decisions and focus protection.

This spec defines the v1 build target as **Option B (hybrid clarity engine)** and captures **Option A (agent-first orchestrator)** as a future-path architecture for Virgil-level capability.

## Product Boundaries

### In scope for v1 (Option B)

- Daily command center with adaptive top-priority surfacing (3-7 items).
- Unified context from manual capture, calendar, existing tasks/projects, memory/context signals, and habit/review history.
- Deterministic priority matrix scoring as the system of record for ranking.
- Model-assisted explanation, draft plan wording, and nudge phrasing.
- Automation policy that auto-executes only low-risk actions.
- Accountability staleness ladder: gentle nudge -> structured reset -> accountability prompt.
- Calm UX contract: concise "Now / Next / Later", limited active priorities, defer list.

### Out of scope for v1

- Fully model-led prioritization and orchestration.
- Unbounded autonomous action windows.
- High-impact auto-execution (irreversible or sensitive actions).
- Cross-channel autonomous messaging as default behavior.

## Architecture Overview

Sophon v1 uses four bounded modules with clear responsibilities:

1. **Input Aggregator**
   - Collects and normalizes all configured life-management signals into a shared "today context".

2. **Clarity Engine (deterministic core)**
   - Computes the adaptive priority matrix and focus set using transparent scoring dimensions.
   - Owns ranking truth and reproducibility.

3. **Automation + Accountability Layer (model-assisted)**
   - Executes low-risk actions automatically under policy.
   - Generates concise drafts/suggestions and runs staleness interventions.
   - Never overrides deterministic ranking.

4. **Calm UX Contract**
   - Enforces low-overwhelm output boundaries and focus-protective presentation.

## Components and Data Flow

### 1) Morning Build (`buildDailyCommandCenter`)

- Ingests all five input streams.
- Normalizes tasks, events, commitments, follow-ups, and habit-state signals into a common schema.
- Computes daily load band (3-7 priorities) from calendar load, carryover, and staleness pressure.

### 2) Priority Matrix (`scorePriorityMatrix`)

- Applies deterministic scoring dimensions:
  - impact,
  - urgency/time window,
  - commitment risk,
  - effort and time-fit,
  - habit decay risk.
- Returns ranked candidates plus explanation tokens for transparency.

### 3) Action Planner (`generateActionSet`)

- Selects low-risk actions for immediate auto-execution.
- Produces one-tap approval actions for medium-risk actions.
- Routes high-impact actions to suggest-only mode.

### 4) Accountability Loop (`runStalenessLadder`)

- Detects stale review/habit cadence.
- Executes escalation stages:
  1. gentle nudge with one clear next action,
  2. structured 2-minute reset ritual,
  3. accountability prompt with explicit recovery commitment.

### 5) Calm Renderer (`renderDailyBrief`)

- Produces a concise brief: "Now / Next / Later".
- Surfaces only active focus priorities in the primary view.
- Keeps secondary detail collapsed by default to prevent overload.

### 6) End-of-Day Review (`commitDailyReview`)

- Captures completed work, misses, and carry-forward items.
- Stores calibration feedback to tune adaptive load and staleness thresholds.

## Decision and Policy Rules

### Adaptive Priority Count

- Daily focus count is adaptive in the 3-7 range.
- Inputs for adaptation: calendar intensity, task density, commitment windows, and recent execution quality.
- Default behavior should bias lower counts during high-load or high-friction days to protect clarity and calm.

### Automation Authority

- Default mode: auto-execute low-risk actions; require approval for medium/high-risk actions.
- Low-risk actions must be reversible or non-destructive.
- Policy violations automatically downgrade action mode to approval-required.

### Accountability Durability

- Staleness detection tracks drift in review loops and habit follow-through.
- Escalation is stateful and progressive, not repetitive.
- Cooldowns prevent repeated interventions in short windows.

## Error Handling and Resilience

- Any single-source ingestion failure degrades gracefully and still produces a usable daily brief.
- Partial-context days are explicitly labeled, not hidden.
- Priority matrix always returns deterministic fallback output.
- Automation failures are logged and downgraded (not silently retried without bounds).
- Duplicate nudges are prevented via dedup/cooldown controls.

## Safety and Trust

- No high-impact auto-execution in v1.
- Global user override for "suggest-only" mode is always available.
- Every ranked item and intervention includes plain-language "why now" explanation.
- Automated action logs must include trigger, policy reason, and reversibility marker.

## Testing Strategy

### Unit tests

- Priority scoring calculations and weighting behavior.
- Adaptive 3-7 selector across load profiles.
- Low-risk classifier and policy downgrades.
- Staleness transition logic and cooldown enforcement.

### Integration tests

- End-to-end daily build from mixed input streams.
- Partial failure behavior (for example missing calendar stream).
- Action planner routing between auto/approve/suggest levels.

### Behavioral regression tests

- Calm constraints (max surfaced priorities and concise brief shape).
- Nudge deduplication and escalation correctness.
- Stable ranking output for fixed fixtures.

## Success Criteria (v1)

- Daily brief consistently surfaces a focused priority set (adaptive 3-7) with clear explanations.
- Low-risk automation reduces planning overhead without trust regressions.
- Staleness ladder recovers review/habit loops with measurable re-engagement.
- Users report reduced overwhelm and improved next-action clarity.

## Future Path: Option A (Virgil-level Evolution)

Option A remains a deliberate future architecture, not a v1 build target.

### Future characteristics

- Model-led orchestration for ranking, planning, and intervention strategy.
- Richer autonomous reasoning across longer context windows.
- Potentially broader autonomous execution windows with stronger guardrails.

### Preconditions before adoption

- Robust evaluation harness for decision quality and safety.
- Mature trust controls, policy auditability, and rollback mechanisms.
- Proven stability and user trust on Option B baseline metrics.

### Migration principle

Evolve from Option B to Option A by replacing bounded decision surfaces incrementally, while preserving deterministic fallback paths and calm UX safeguards.
