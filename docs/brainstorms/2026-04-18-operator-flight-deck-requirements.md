# Requirements: Operator Flight Deck (incident triage MVP)

Date: 2026-04-18  
Status: Draft for planning handoff  
Source: `docs/ideation/2026-04-18-open-ended-repo-improvements.md` (survivor #4)

## Problem

Virgil has improved reliability diagnostics across multiple routes and handlers, but operators still need to stitch signals together manually across pages, logs, and docs during incidents. This increases diagnosis time and recovery uncertainty.

### Evidence baseline (current state)

- Current pain is treated as a validated operator hypothesis from recent reliability hardening work, but no single triage-time baseline is yet recorded.
- MVP includes baseline capture so outcome claims are measurable, not anecdotal.

## Goal

Reduce mean time to triage and recover from operator-visible incidents by providing a minimal, centralized flight deck that prioritizes actionable signal over exhaustive telemetry.

## Primary outcome

- Faster incident triage (diagnose and recover quickly).

## Scope

### In scope (MVP)

- A minimal top-level operator summary view that links into deeper existing pages.
- Explicit incident triage focus, with **chat fallback/error visibility as the must-have signal**.
- Exactly one safe one-click action plus suggested runbook actions.
- No new external infrastructure/services.

### Out of scope (MVP)

- Deep historical analytics/reporting.
- Large visual redesign of operator UI.
- Fully autonomous remediation actions.
- New third-party observability stack.

## Key definitions (MVP)

- **Hosted path:** default gateway-backed chat execution path.
- **Local path:** Ollama-backed local execution path.
- **Fallback path:** explicit escalation/retry path used when the selected primary path fails pre-stream.
- **Current window:** last 15 minutes.
- **Trend window:** current 15 minutes compared to previous 60 minutes.
- **Confidence state:** `healthy`, `degraded`, or `unknown` based on source freshness and availability.

## Existing context to leverage

- Reliability hardening artifacts already in place from `docs/tickets/2026-04-18-v1-1-m4-reliability-observability-hardening.md`.
- Existing routes/pages for background jobs, health, night review, digest, and delegation health.
- Existing operator runbook documentation to power guided remediation suggestions.

## Approach options considered

### Option A: New standalone command-center page

Create a full new top-level flight deck with all diagnostics and controls in one place.

Pros:
- Clear single destination for operators.
- Maximum design freedom.

Cons:
- Higher build and maintenance cost.
- Risk of duplicating existing pages.

Best when:
- The team wants a major operator UX replatform.

### Option B: Extend existing pages only

Keep current surfaces and add targeted diagnostics/actions to each page.

Pros:
- Lowest initial build scope.
- Reuses existing UI and route ownership.

Cons:
- Maintains fragmented triage experience.
- Slower incident navigation under pressure.

Best when:
- Only local improvements are needed and cross-surface triage is not the bottleneck.

### Option C (recommended): Hybrid minimum summary + deep links

Add a small top-level flight deck summary page for rapid triage, then route operators into existing detailed pages for investigation/remediation.

Pros:
- Directly addresses incident triage speed.
- Avoids rebuilding existing surfaces.
- Keeps implementation and carrying cost bounded.

Cons:
- Requires disciplined summary signal design.
- Some operators may still need to context-switch into deeper pages.

Best when:
- Stabilization is the priority and the team needs high leverage with modest scope.

## Recommended direction

Proceed with **Option C** (hybrid). It matches the selected primary outcome (triage speed), preserves existing investments, and stays aligned with stabilization constraints (no new external infra).

Failure condition for this direction:
- If operators still need to open 3+ destinations before selecting a first recovery action, MVP fails its triage objective.

## MVP requirements

1. Provide a top-level operator summary surface focused on current system health and incident triage.
2. Include a prominent “chat fallback/error” panel that answers:
   - Are fallback/error rates elevated right now?
   - Which path is failing most (hosted, local, fallback path)?
   - Is failure trend improving or worsening in the recent window?
3. Include one adjacent status indicator in MVP (queue/job health) as secondary context; defer additional adjacent indicators to post-MVP.
4. For the initial MVP incident class coverage (chat fallback/error incidents), provide:
   - likely cause hints,
   - runbook-linked suggested steps,
   - and exactly one safe one-click action where clearly reversible/low risk.
5. Deep-link from summary cards into existing detailed pages rather than duplicating full detail views.
6. Make degraded state obvious (clear severity, freshness, and confidence state) so operators can trust whether a signal is current.
7. Ensure flight deck behavior degrades gracefully when one source signal is unavailable (partial visibility over blank failure).
8. Define deterministic triage ordering for MVP:
   - severity order: `critical > high > medium > low`
   - tie-breakers: recency first, then confidence (`healthy > degraded > unknown`)
   - stale primary chat signal forces top-level status to `unknown` until refreshed.
9. Define one-click interaction contract:
   - pre-check before action,
   - explicit confirmation with impact scope,
   - in-progress and completion feedback,
   - rollback or explicit manual recovery path,
   - action audit entry.
10. Add durable telemetry support for flight deck summary cards (not file-only logs), including per-path fallback/error counts and freshness timestamps for current/trend windows.

## Safety and guardrails

- One-click action must be limited to low-risk, clearly scoped operations.
- Actions that can cause side effects beyond local recovery remain suggestion-only in MVP.
- No autonomous background self-healing without explicit operator intent.
- RBAC is required for flight deck actions: read access and action access are distinct; one-click requires operator-or-higher role.
- Operational action requests must use integrity protections (CSRF/session-safe pattern, idempotency key, and replay-resistant action token).
- Action abuse controls are required (cooldown and single-flight lock) to prevent duplicate or rapid-fire triggering.
- Every one-click action must produce an immutable audit event (`actor`, `action`, `target`, `timestamp`, `requestId`, `outcome`).

## Success criteria

### Product/ops outcomes

- Operators can identify the likely incident category and next recovery step from the flight deck without searching docs manually.
- Median time-to-first-correct-action improves by 30% versus baseline after launch window measurement.
- Median time-to-stable-state improves by 20% for covered MVP incident class.

### MVP acceptance checks

- Chat fallback/error signal is visible, understandable, and linked to remediation guidance.
- Operators can navigate from top-level summary to deeper diagnostics in one step.
- Exactly one safe one-click action is available, clearly labeled, and audit-logged.
- Summary cards show freshness timestamp and confidence state.
- Flight deck remains usable when a secondary signal source is unavailable.
- No new external services are required for MVP operation.

## Open questions for planning

1. Which one-click action has the best safety-to-value ratio for first release?
2. What is the lowest-complexity durable telemetry shape for summary cards that avoids new infrastructure?
3. Which role model implementation should be used for operator action authorization in this repository’s current auth setup?

## Opportunity cost and sequencing

- This work should be treated as the immediate operator-confidence layer for already-shipped reliability diagnostics.
- If prioritized now, defer non-critical UX polish and non-MVP analytics expansion until after flight deck MVP validation.
