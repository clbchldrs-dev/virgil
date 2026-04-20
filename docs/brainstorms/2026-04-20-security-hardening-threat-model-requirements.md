---
date: 2026-04-20
topic: security-hardening-threat-model
---

# Security hardening: threat-model backlog (confidentiality-first)

## Problem Frame

**Who:** Operators and the single owner using Virgil (hosted on Vercel, optional LAN gateways via Hermes/OpenClaw), plus anyone with access to support exports or logs.

**What:** “Security hardening” was scoped as an **end-to-end threat model** with a **prioritized backlog**. The **first-quarter anchor** is **preventing secret and PII leakage** through **logs, UI, error responses, and operator-facing payloads** (including deployment/diagnostics). Other areas (delegation abuse, session security, supply chain) remain **in scope** as supporting controls ordered after confidentiality.

**Why it matters:** Virgil already documents a **user-safe** contract for deployment diagnostics (`lib/deployment/build-deployment-diagnostics-payload.ts` — “No secrets or raw env values”). Hardening means **making that contract enforceable everywhere it matters**, not only where comments already say so. A single leaky surface undermines trust in the whole product.

**Relationship to other work:** Delegation visibility and access are covered in `docs/brainstorms/2026-04-19-hermes-openclaw-delegation-access-requirements.md` (especially transparency, role matrix, and honest prompts). This document **does not duplicate** those feature requirements; it adds **cross-cutting security** expectations that planning should **not violate** when implementing R1–R12.

## Requirements

**Confidentiality and disclosure (P0 — anchor)**

- **R1.** **Stable redaction rule:** Any **operator-exportable** JSON, UI copy, or structured log intended for troubleshooting MUST NOT include raw secrets, bearer tokens, shared secrets, tunnel URLs with embedded credentials, or full raw environment values. **User-safe strings only**, consistent with existing deployment diagnostics posture (`buildDeploymentDiagnosticsPayload` and equivalents).

- **R2.** **Error path parity:** User-visible and support-facing **errors** (API routes, delegation worker responses, chat tool failures) MUST NOT echo **config fragments** that recover secrets (e.g. full connection strings, `Authorization` headers). Where detail is needed, use **error classes / codes** plus safe hints (e.g. “check `HERMES_BASE_URL` is set”) without values.

- **R3.** **PII boundary:** Chat content and identifiers that could identify a person MUST follow the **same retention and visibility rules** as the rest of the product; **new** observability or delegation-insight features MUST NOT widen exposure without an explicit product decision (see delegation R8 bound).

**Authentication, session, and API surface**

- **R4.** **Session-bound actions:** Mutations and sensitive reads remain **consistent with existing auth** — no new “open” endpoints for capabilities that imply **control** or **secret-bearing** state unless the threat model explicitly accepts that tradeoff and documents compensating controls.

- **R5.** **Cross-origin and browser semantics:** Any change to cookies, CORS, or browser-callable APIs MUST preserve **expected single-tenant** assumptions; planning validates **CSRF** and **credential** behavior for new or altered routes.

**Delegation and trust boundaries**

- **R6.** **Passthrough honesty:** Virgil MUST NOT **amplify** gateway trust — delegated execution policy stays on the **gateway**; Virgil surfaces **visibility** and **strict allowlists** without inventing **parallel secret channels** (aligned with `AGENTS.md` and delegation Key Decisions).

- **R7.** **Worker and poll secrets:** Worker authentication (`VIRGIL_DELEGATION_WORKER_SECRET` and related) MUST remain **server-only**; responses and logs MUST NOT reflect secret material or compare secrets in ways that leak via timing/side channels in product-visible paths (planning reviews **claim** vs **verify** patterns).

**Operations and supply chain**

- **R8.** **Dependency hygiene:** Releases MUST NOT silently weaken **lockfile integrity** or bypass **existing CI security checks**; upgrades follow **project conventions** (`AGENTS.md` / CI). Scope is **process + gates**, not a one-off audit.

- **R9.** **Operational logging:** Server and edge logs MUST default to **redacted** structured fields for tokens and secrets; if full debug logging exists, it MUST be **explicitly gated** (env / local-only) and documented as unsafe for production.

## Threat backlog (ordered for planning)

Use this as a **priority stack**, not parallel epics:

| Tier | Focus | Tie to requirements |
|------|--------|---------------------|
| **1** | Payloads, exports, deployment/capabilities JSON, chat/delegation error strings | R1, R2 |
| **2** | API auth consistency, new routes, cookie/CORS | R4, R5 |
| **3** | Delegation worker boundary, gateway responses | R6, R7 |
| **4** | CI/lockfile, dependency updates, log redaction defaults | R8, R9 |

**Non-obvious angle (inversion):** If we **removed** all operator diagnostics and logged nothing, confidentiality would be easier — so the product pressure is **observability without disclosure**; every new diagnostic field must pass **R1**.

## Success Criteria

- Support or an operator can share a **deployment diagnostics export** without manually scrubbing secrets (machine-enforced, not policy-only).
- Spot checks of **error paths** for delegation and deployment do not reveal tokens or raw env values.
- A short **internal or doc-linked checklist** exists for **what must never appear** in logs/UI exports (derived from R1–R2), kept next to code that builds operator-visible payloads.
- Lower tiers (auth surface, delegation worker, supply chain) have **at least one tracked** planning item each — no silent “we forgot tier 4.”

## Scope Boundaries

- **In scope:** Product-visible and operator-visible **disclosure** risks; **alignment** of new features with single-tenant and passthrough assumptions; **process** for dependency and CI security.
- **Out of scope for this document:** Formal SOC2/ISO certification; **gateway-internal** hardening inside Hermes/OpenClaw repos (document and link; separate change if wire protocol changes).
- **Out of scope unless reopened:** **Per-user skill RBAC** in Virgil — see delegation brainstorm R9; default remains env + gateway + clear role matrix.

## Key Decisions

- **End-to-end threat model** with **secret/PII leakage as the ordering anchor** for the first tranche of work.
- **Layered controls:** Redaction and safe payloads **first** (R1–R3); auth and delegation boundaries **next** (R4–R7); ops/supply chain **ongoing** (R8–R9).
- **Compatibility:** Does not override delegation **visibility** goals — it **constrains** how much “insight” can ship without a **PII/secrets review** (R3).

## Dependencies / Assumptions

- Existing **user-safe** diagnostics pattern in `lib/deployment/build-deployment-diagnostics-payload.ts` is the **reference contract** for R1.
- Single-tenant and **gateway-side policy** assumptions in `AGENTS.md` remain authoritative for delegation.

## Outstanding Questions

### Resolve Before Planning

*None — ordering and P0 anchor are explicit.*

### Deferred to Planning

- **[R1][Technical]** Inventory all code paths that serialize **capabilities**, **delegation health**, or **errors** to clients or exports; confirm each path funnels through redaction or is explicitly safe.
- **[R2][Technical]** Standardize **error shape** (code + safe message) for delegation routes to avoid ad-hoc `error.message` forwarding from upstream.
- **[R3][Product]** If delegation “insight” (delegation brainstorm R8) ships, define **minimum** fields for operators vs **forbidden** fields — pair with retention review.
- **[R5][Needs research]** Current middleware and Route Handler **CSRF** posture for cookie-session mutations — validate on any new browser-visible API.
- **[R9][Technical]** Whether structured logging uses a **central serializer** today; if not, smallest **choke point** for redaction.

## Next Steps

-> `/ce:plan` for structured implementation planning. **Suggested first milestone:** R1–R2 inventory + tests that fail if a secret-shaped string appears in diagnostics or categorized error payloads; then R9 log defaults; then R4–R5 for any route touched by the same release.

## Alternatives Considered

- **Audit-only (no tests):** Low carrying cost but **high recurrence risk** — rejected as sole approach; pair policy with **automated** or **contract** checks where cheap.
- **Shut off diagnostics:** Maximum confidentiality, **unacceptable** operator support cost — rejected.
- **Full RBAC for every tool:** High carrying cost; **out of scope** unless product reopens delegation R9.
