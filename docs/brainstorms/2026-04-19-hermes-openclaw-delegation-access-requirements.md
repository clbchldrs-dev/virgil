---
date: 2026-04-19
topic: hermes-openclaw-delegation-access
---

# Hermes & OpenClaw: accessibility, power, and more tools

## Problem Frame

**Who:** Operators self-hosting Virgil with optional **Hermes** and/or **OpenClaw** bridges (`lib/integrations/delegation-provider.ts`, `docs/openclaw-bridge.md`), and **owners** using chat with `delegateTask` / `embedViaDelegation` / approval flows.

**What hurts today:**

- **Discoverability:** The in-app deployment surface (`lib/deployment/capabilities.ts`, `components/deployment/capabilities-panel.tsx`) lists canonical in-process companion tools but **does not surface delegation** (whether Hermes/OpenClaw is configured, reachable, or which backend is primary/failover). Users cannot tell from the product whether “ask OpenClaw to do X” is even possible on this deployment.
- **Skill opacity:** `delegateTask` depends on gateway-published skill ids (`delegationListSkillNamesUnion`, keyword match, or `generic-task`). Models often omit or null `skill` (mitigated in code with `.nullish()`), or guess wrong ids — there is no **first-class, user-visible skill catalog** tied to the live bridge.
- **Power ceiling:** “More tools” mostly live on the **gateway host** (Hermes skills wrapping OpenClaw, extra skills in catalog). Virgil can expose them better **without** duplicating gateway logic — by making the **contract** (env, skill list, prompts) obvious and testable.

**Split responsibility (watch):** The line “gateway-side skill registration is the main lever; Virgil surfaces, routes, confirms” is correct — but it means **operator setup is load-bearing**. If Hermes/OpenClaw are misconfigured or skills are never registered on the host, better Virgil UI only removes **one** hop of confusion; it does not create capabilities. **R6 (runbooks + checklisted path)** is therefore **as important as R1–R3** for the overall “more tools” promise, not a documentation footnote.

**Why it matters:** Delegation is the path to LAN execution, messaging, and shell/files; if it feels invisible or brittle, the product reads as “chat only” even when the operator did the hard wiring.

## Requirements

**Transparency & trust**

- **R1.** The deployment capabilities API/UI (or an equivalent **operator-appropriate** surface) reports **delegation status**: whether delegation is configured, which **primary backend** is selected (`VIRGIL_DELEGATION_BACKEND` / auto), whether **failover** is active (`VIRGIL_DELEGATION_FAILOVER`), and **reachability** at snapshot time (without leaking secrets or raw URLs). User-safe strings only, aligned with `buildDeploymentCapabilities()` style. **Product decision:** which roles may see this (e.g. owner-only vs any logged-in user) must be explicit during planning — same gating assumptions as the rest of the deployment page.

**Skill & tool discoverability**

- **R2.** **Operators** (and optionally the owner in chat via deterministic context) can see a **live or recently cached list of delegation skill ids** (and short labels/descriptions when the gateway provides them), scoped to what Virgil would use for `delegateTask` / strict allowlist — so “what can I ask for?” is answerable without reading the repo. **Clarification:** one canonical source for this list (server snapshot feeding UI and/or prompt appendix) is preferred over duplicating strings in multiple places.

  **Risk — staleness:** If the cached list lags the gateway, users and models are back to **the same opacity problem with one fewer hop** — wrong expectations about which skills exist. Planning must pair any TTL/cache with an explicit **freshness signal** (e.g. snapshot time, “stale” warning, or manual refresh) and acceptance tests that bad staleness does not silently pass as truth.

- **R3.** Companion / system guidance stays aligned with reality: when delegation tools are registered, prompts should not **overpromise** tools that are absent, and should **point to** how skill ids are chosen (explicit id vs infer vs `generic-task`), consistent with `buildDelegateTaskToolDescription()`. **Bound:** derive wording from the same **tool-registration / capability snapshot** used for R1–R2 where possible, so prompt edits stay a small, enumerable set of call sites.

**Reliability & ergonomics**

- **R4.** Delegation entrypoints (`delegateTask`, optional `embedViaDelegation`) remain **robust to model output** (e.g. optional fields sent as JSON `null`); error messages continue to suggest **omitting `skill`** or picking from the published list (`delegationUnknownSkillMessage` pattern).

- **R5.** When **both** Hermes and OpenClaw are configured, product behavior is **explainable**: document or surface whether intents always go to primary vs failover, and whether users can **target** a specific backend for an intent. **Near-term decision (even if the answer is “no pinning”):** As soon as both gateways are live, **inconsistent routing** (failover vs primary vs skill id only on one side) will surface in support and chat. Resolve **early** whether `delegateTask` is **failover-only** with documented semantics, or gains an explicit backend pin — and reflect that in UX, errors, and docs so nobody infers per-request routing that does not exist.

**Unlocking “more tools” (split responsibility)**

- **R6.** Requirements treat **gateway-side skill registration** as the main lever for new capabilities; Virgil **surface, route, confirm**. **R6 is load-bearing:** product work must ship alongside **operator-runbook quality** — not a single “see also” link. Concretely: **canonical** entry points (`docs/openclaw-bridge.md`, `docs/virgil-manos-delegation.md` or successors) stay **complete enough** that a capable operator can go from zero → working skills list → Virgil sees those skills; gaps belong in the runbook or in explicit “troubleshooting” sections. In-app surfaces (R1, R7 if shipped) **link** to those anchors rather than duplicating prose, but **planning** allocates time to **verify** runbook steps against current env names and flows (drift is a product bug for this epic).

- **R7.** Optional **stretch:** a guided “**Delegation setup**” subsection in settings or deployment page: env checklist (Hermes URL, secret, OpenClaw paths), link to health, and “expected skill ids” — **without** embedding secrets in the client.

## Success Criteria

- A user opening the **deployment / capabilities** area can answer: Is delegation on? Which backend? Is it up?
- A model or human can obtain a **canonical list of skill ids** (or documented fallback to `generic-task`) without reading the repo.
- Operators report fewer “delegation works in curl but Virgil says offline” mismatches — health and configuration are **legible** from the app or one doc path.
- Runbook path (R6) is **kept current** with the same releases that touch delegation code or env vars (no orphan docs).
- No regression to **safety**: confirmation for destructive/outbound actions remains; strict allowlist (`VIRGIL_DELEGATION_STRICT_SKILLS`) behavior stays documented.

## Scope Boundaries

- **Out of scope:** Implementing new skills inside OpenClaw/Hermes repos, or changing gateway wire protocols — **document and link** only unless Virgil’s HTTP client contract must change (separate plan).
- **Out of scope:** Guaranteeing unlimited tools on hosted Vercel without a tunnel/LAN gateway — product remains honest about **where** execution runs (`AGENTS.md` posture).
- **In scope:** Virgil UI/API, prompts, operator docs touchpoints, and small **read-only** proxies that expose gateway skill metadata safely.

## Key Decisions

- **Split responsibility:** “More tools” = primarily **gateway catalog + operator setup**; Virgil improvements focus on **visibility, discoverability, and prompt alignment** (not re-implementing OpenClaw). **Operator runbooks are part of the deliverable**, not optional narrative.
- **Trust over hype:** Surface reachability and backend choice **honestly** (failover, offline backlog) rather than hiding errors.
- **Dual-backend clarity:** Pinning vs failover-only (R5) is decided **before** shipping UX that could be read as per-request backend selection; “failover only, documented” is a valid outcome.

## Dependencies / Assumptions

- Hermes/OpenClaw expose listable skills over existing HTTP paths (`delegation-provider` integration).
- Deployment capabilities route remains unauthenticated or consistently gated — **do not** expose shared secrets.

## Outstanding Questions

### Resolve Before Planning

- **[R5][Product]** **Backend targeting:** Confirm whether `delegateTask` may ever **pin** to Hermes vs OpenClaw when both are configured, or remains **primary + failover only** with no per-call override. **Decide early** (even if the answer is failover-only): document semantics in AGENTS-level operator docs and avoid UI that implies pinning until supported.

### Deferred to Planning

- **[R2][Needs research]** Cache skill list with TTL vs fetch on each delegation tool registration / periodic refresh — latency vs freshness tradeoff; **spike gates** the API shape for R2. **Must** address staleness UX (see R2 risk) in the same design pass.
- **[R7][UX]** Single “Delegation” card vs full settings subpage — cap R7 to a short checklist + links unless design capacity is confirmed (avoid a second onboarding product).

## Next Steps

-> `/ce:plan` for structured implementation planning. **Suggested order:** **Resolve R5** (document-only is fine) in parallel with **R6 audit** (runbook completeness + links) → R1 → R2 (TTL/spike + staleness behavior) → R3 → **R6** (verify links and troubleshooting from deployment UI). Defer R7 unless scoped.

**Sequencing note:** R6 is not “afterthought documentation”; treat **runbook verification** as a planning task with acceptance criteria, same tier as R1.

## Alternatives Considered

- **Gateway-only docs (no product change):** Lowest cost but leaves chat users and models blind — rejected as sole solution.
- **New composite “mega tool” in Virgil that duplicates OpenClaw:** High carrying cost; rejected in favor of catalog surfacing + gateway skills.
