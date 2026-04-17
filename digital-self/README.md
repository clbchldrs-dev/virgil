# Virgil Digital Self (orchestrator)

Standalone service that ingests normalized messages from **Slack**, **WhatsApp Business**, and **SMS** (iMessage bridges use the SMS adapter shape), runs a **risk policy** + **interference mode**, and either **auto-sends** low-risk replies or **queues drafts** for approval.

**Scheduled digest vs Digital Self:** The main Virgil app can mirror the **daily email digest** to Slack via webhook or bot token ([operator-integrations-runbook.md](../docs/operator-integrations-runbook.md)) without running this service. Use Digital Self for **inbound** Slack events, interference modes, and **approval-gated** outbound messages.

## Quick start

```bash
cd digital-self
pnpm install
cp .env.example .env
pnpm dev
```

- Health: `GET http://localhost:8790/health`
- Ingest (Bearer `DIGITAL_SELF_INGEST_SECRET`): `POST /v1/ingest`
- Approvals (Bearer `DIGITAL_SELF_SERVICE_TOKEN`): `GET|PATCH /v1/approvals`

## Docs

- Safety policy ADR: [docs/adr/0001-safety-and-approval-policy.md](docs/adr/0001-safety-and-approval-policy.md)
- Virgil bridge: [../docs/digital-self-bridge.md](../docs/digital-self-bridge.md) (in main repo)

## Scripts

| Command        | Purpose              |
| -------------- | -------------------- |
| `pnpm dev`     | Watch mode server    |
| `pnpm test`    | Unit + policy tests  |
| `pnpm check`   | Biome                |
| `pnpm build`   | Emit `dist/`         |
