---
date: 2026-04-19
topic: local-vs-vercel-information-parity
---

# Local vs Vercel: unified deployment information

## Problem Frame

Developers and operators move between **local** (full capabilities, Ollama, local-only tools) and **Vercel** (constrained runtime, different model paths, gated tools). The product currently feels like two different experiences: not primarily because capabilities differ—that is often unavoidable—but because **it is hard to know what this deployment can do** in each context. The desired outcome is **consistent information architecture**: the affordances may differ, but the user should always understand what is available *here*, without surprise or archeology in docs.

## Requirements

**Information architecture**

- R1. The product should expose a **single, coherent picture of deployment capabilities** (what models, tool families, and major integration surfaces are available in this running instance), written for humans, not raw configuration dumps.
- R2. Where a capability is **absent on this deployment**, the UI or adjacent help should make that **explicit at point of use** (e.g. model picker, tool invocation, settings)—not only in external documentation.
- R3. **Parity of clarity**, not parity of features: it is acceptable that local and hosted differ; it is not acceptable that users discover gaps only by failure or by reading unrelated docs.

**Audience and safety**

- R4. Any detailed or diagnostic view must respect **who should see it**: end users vs signed-in project owners/operators. Sensitive internals should not be exposed to the wrong audience.

## Success Criteria

- A user opening the app on **local** and on **Vercel** can answer, without leaving the product: *What can I use here?* and *Why is X missing?* at least at the level of major capability groups (models, agent tools, integrations).
- Fewer “works on my machine” surprises that stem from **undiscoverable** differences rather from unavoidable platform limits.
- Operators have a clear path to confirm deployment health without treating production as a black box—without turning production into a leaky debug console for everyone.

## Scope Boundaries

- **Non-goal:** Making every local-only capability (e.g. LAN Ollama, arbitrary shell) work on Vercel; that may be separate work and is explicitly out of scope for this problem frame.
- **Non-goal:** Replacing `docs/vercel-env-setup.md` or `AGENTS.md`; those remain reference material, but the product should **bridge** to them where helpful.
- **In scope:** Product-facing clarity, discoverability, and optional owner-grade diagnostics aligned with R4.

## Key Decisions

- **Information-first parity:** Prioritize unified *understanding* of what each deployment supports over matching feature lists across environments.
- **Explicit tension acknowledged:** Today, detailed status-style endpoints are intentionally limited in production (to avoid exposing internal env state to end users). Addressing R1–R3 may require a **deliberate redesign** of what is shown to whom—not simply “turn on the same banner everywhere.”

## Dependencies / Assumptions

- **Verified:** `app/api/virgil/status/route.ts` returns 404 in production unless explicitly enabled, reflecting a product choice to hide dev-oriented status from hosted users.
- Some capability gating is **environment-based** (e.g. local-only tools when not on Vercel); requirements assume planning will map these gates to user-visible explanations without duplicating logic in scattered copy.

## Outstanding Questions

### Resolve Before Planning

- (none)

### Deferred to Planning

- [Affects R1][Technical] Exact mechanism for a **single source of truth** for “what this deployment supports” (derived from existing server-side gates vs maintained manifest)—to avoid drift between UI and behavior.
- [Affects R4][Needs research] **Audience model**: which surfaces are owner-only, signed-in user, or public—and how that aligns with existing auth and settings patterns.
- [Affects R2][Technical] **Point-of-use** patterns: banners vs inline empty states vs settings “capabilities” page—balance between visibility and noise.

## Next Steps

-> `/ce:plan` for structured implementation planning
