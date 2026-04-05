# ADR 0001: Digital Self safety and approval policy

## Status

Accepted — 2026-04-05

## Context

The Digital Self orchestrator can draft and send messages on behalf of the owner across **Slack**, **WhatsApp Business**, and **SMS** (including experimental iMessage bridges that present as SMS-like webhooks). Wrong sends are socially and legally costly.

## Decision

### Policy classes

1. **`alwaysApprove` (implicit)** — Any inbound that scores as high-stakes routes to **approval** or **block**, never auto-send:
   - Legal, financial, HR, relationship crisis, credentials, or strong commitment language (see `src/core/policy-engine.ts` patterns).
2. **`autoAllowed`** — Only when **interference mode** + **trust tier** + **risk score** jointly allow it (see `evaluatePolicy`).
3. **`block`** — Score ≥ 85: no draft send path; inbound is logged and dropped from automation.

### Interference modes

| Mode            | Behavior |
| --------------- | -------- |
| `shield`        | **Hold** — no outbound automation; batching/summary is owner-driven. |
| `assistant`     | Default **approval**; narrow exception for trusted + very low-risk acknowledgments. |
| `autopilot-lite`| Auto-send when score is below a trust-aware threshold; otherwise approval. |

### Trust tiers

Per conversation thread (`externalThreadId`): `unknown` < `acquaintance` < `trusted`. Unknown senders get higher base risk.

### Non-negotiables

- **No false certainty** in customer-facing copy templates: drafts state context and ask for next step rather than fabricating facts.
- **Human override** — Approvals API and PATCH flows always allow reject; DLQ retry is explicit.
- **Immutable audit** — Every inbound, policy decision, draft, approval resolution, send attempt, and DLQ enqueue is recorded (`audit` store).

### Secrets and verification

- **Ingest** and **service** APIs require `Bearer` tokens (`DIGITAL_SELF_INGEST_SECRET`, `DIGITAL_SELF_SERVICE_TOKEN`).
- **Slack** requests verified with signing secret when `SLACK_SIGNING_SECRET` is set.
- **WhatsApp** payloads verified with `X-Hub-Signature-256` when `WHATSAPP_APP_SECRET` is set.
- **Twilio** webhooks verified with `X-Twilio-Signature` when `TWILIO_AUTH_TOKEN` is set.

## Consequences

- Conservative defaults: most traffic in `assistant` mode goes to approval.
- Auto-send is an explicit product choice per mode and must be tuned using metrics (`/v1/metrics`) and audit review.
