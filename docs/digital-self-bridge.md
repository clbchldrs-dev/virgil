# Digital Self orchestrator bridge

The **Digital Self** service lives in [`digital-self/`](../digital-self/) as a separate Node package. It ingests Slack / WhatsApp / SMS webhooks, applies **risk policy** and **interference modes**, and either **auto-sends** (when allowed) or **queues drafts for approval**.

## Virgil ↔ Digital Self

| Direction | Mechanism |
| --------- | --------- |
| Virgil checks orchestrator liveness | `GET /api/digital-self/bridge-health` (session auth) → `GET {DIGITAL_SELF_BASE_URL}/health` |
| Orchestrator notifies Virgil when an approval is queued | Set `VIRGIL_BRIDGE_WEBHOOK_URL` to `https://<your-app>/api/digital-self/webhook` on the orchestrator; use the **same** secret as Virgil’s `VIRGIL_BRIDGE_WEBHOOK_SECRET` in the `Authorization: Bearer …` header |

Implement the webhook in Virgil if you want in-app banners or Memory rows; the payload shape is `{ type: "digital-self.approval.queued", approvalId, channel, threadId, preview }`.

## Env vars (Virgil / Next.js)

| Variable | Purpose |
| -------- | ------- |
| `DIGITAL_SELF_BASE_URL` | Base URL of the running orchestrator (e.g. `http://127.0.0.1:8790`) |
| `DIGITAL_SELF_SERVICE_TOKEN` | Same value as the orchestrator’s `DIGITAL_SELF_SERVICE_TOKEN` if you add server-side calls to `/v1/approvals` or `/v1/metrics` from Virgil later |

Orchestrator-side vars are documented in [`digital-self/.env.example`](../digital-self/.env.example) and ADR [`digital-self/docs/adr/0001-safety-and-approval-policy.md`](../digital-self/docs/adr/0001-safety-and-approval-policy.md).

## Client helper

See [`lib/integrations/digital-self-client.ts`](../lib/integrations/digital-self-client.ts) for `pingDigitalSelfHealth`.
