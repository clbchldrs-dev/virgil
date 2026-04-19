# Operator runbook: integrations and env by host

Single-owner checklist to verify **calendar, GitHub, email, Slack, and cron** paths. Keep secrets out of git; mirror this table in your private notes with real hostnames filled in.

## Where env vars live

| Surface | Typical host | Notes |
|---------|--------------|--------|
| **Vercel production** | Vercel project env | No `OLLAMA_BASE_URL` to LAN Ollama from serverless; use gateway models or self-host app on LAN. |
| **LAN / Docker app** | `.env.docker` or server env | Set `OLLAMA_BASE_URL` to Manos or bundled `ollama` service. `AUTH_URL` / `NEXT_PUBLIC_APP_URL` = browser origin. |
| **virgil-manos (Ubuntu)** | Ollama + Hermes (preferred) + optional OpenClaw | Holds inference and delegation; routing: [virgil-manos-delegation.md](virgil-manos-delegation.md). **Not** where Next.js env usually lives unless you self-host the app there. |
| **Developer laptop** | `.env.local` | Local `pnpm dev`; can point `OLLAMA_BASE_URL` at Manos LAN IP. |

Full variable names: [`.env.example`](../.env.example) and [AGENTS.md](../AGENTS.md).

---

## Phase A — verification (happy path)

### 1. Google Calendar (read-only)

1. Set `VIRGIL_CALENDAR_INTEGRATION=1`, `GOOGLE_CALENDAR_CLIENT_ID`, `GOOGLE_CALENDAR_CLIENT_SECRET`, `GOOGLE_CALENDAR_REFRESH_TOKEN` (see [google-calendar-integration.md](google-calendar-integration.md)).
2. Sign in (non-guest). `GET /api/calendar/status` → enabled + configured.
3. `GET /api/calendar/events?timeMin=…&timeMax=…` → JSON events.
4. **Chat:** use a **tool-capable hosted/gateway** model; local Ollama does not register `listCalendarEvents` on the default path.

### 2. GitHub (issues from chat)

1. Set `GITHUB_REPOSITORY`, `GITHUB_PRODUCT_OPPORTUNITY_TOKEN` or `GITHUB_TOKEN`, and agent-task vars if you use `submitAgentTask` (see [github-product-opportunity.md](github-product-opportunity.md)).
2. From chat with a gateway model, run `submitProductOpportunity` / `submitAgentTask` against a **test repo** first.
3. Confirm Issues appear; errors in chat should stay sanitized.

### 3. Email outbound (Resend)

1. `RESEND_API_KEY` set on every host that sends mail.
2. Trigger: `setReminder` → QStash → [`/api/reminders`](../app/api/reminders/route.ts), or wait for cron `GET /api/digest`.
3. Production: verify a **sending domain** in Resend and replace default `from:` addresses in code when ready (currently `onboarding@resend.dev` in several routes).

### 4. Email inbound → Memory

1. `VIRGIL_EMAIL_INGEST_ENABLED=1`, `RESEND_WEBHOOK_SECRET`, `RESEND_API_KEY`, `VIRGIL_EMAIL_INGEST_ALLOWED_FROM`, `VIRGIL_INGEST_USER_ID`.
2. Configure Resend **Webhook** → `POST /api/ingest/email` (see AGENTS.md).
3. Send from an allowlisted address; confirm a new `Memory` row.

### 5. Slack (scheduled check-in)

**Native path (this repo):** When `VIRGIL_SLACK_CHECKIN_WEBHOOK_URL` *or* (`SLACK_BOT_TOKEN` + `VIRGIL_SLACK_CHECKIN_CHANNEL_ID`) is set, each successful **daily digest** email pass also posts the same text to Slack (failures are logged; email still attempts first).

**Interactive / delegated sends:** [OpenClaw bridge](openclaw-bridge.md) (`send-slack` skill on the gateway) and [Digital Self](digital-self-bridge.md) (policy + Slack events) are **separate** stacks—use them when the model or orchestrator should draft/send messages, not for the 08:00 UTC digest mirror.

### 6. Cron

- `CRON_SECRET` + `Authorization: Bearer …` on `GET /api/digest` and `GET /api/night-review/enqueue` (see AGENTS.md § Scheduled jobs).

### 7. Input channels (capture -> review -> act)

Use at least one payload per route in non-production before calling the channel healthy.

| Channel | Route | Auth / gate | Smoke payload | Expected failure behavior |
|---|---|---|---|---|
| Chat | `POST /api/chat` | Session auth (guest/non-guest policy in app) | Send one short note and one actionable request | Model/tool error message in stream; route should not crash |
| General ingest | `POST /api/ingest` | `VIRGIL_INGEST_ENABLED=1` + `Authorization: Bearer $VIRGIL_INGEST_SECRET` + `VIRGIL_INGEST_USER_ID` | `{ "type":"note", "content":"..." }` JSON | `403 ingest_disabled`, `401 unauthorized`, `400 invalid_json/invalid_body`, `500 ingest_misconfigured` |
| Share target | `POST /api/ingest/share` | Session auth, non-guest only | Submit share form with at least one of `title/text/url` | `401 unauthorized`, `403 forbidden`, `400 invalid_form/empty_share` |
| Journal parse | `GET/POST /api/journal/parse` | `VIRGIL_JOURNAL_FILE_PARSE=1` + `Authorization: Bearer $CRON_SECRET` | POST `{ "content":"..." }` for serverless-safe smoke | `403` when disabled, `401` without bearer, parse/model failure JSON |
| Email ingest | `POST /api/ingest/email` | `VIRGIL_EMAIL_INGEST_ENABLED=1` + Svix signature + allowlist | Send one allowlisted message via Resend receiving | Reject unsigned/non-allowlisted payload; no process crash |
| Alexa | `POST /api/channels/alexa` | `VIRGIL_ALEXA_ENABLED=1` + `Authorization: Bearer $VIRGIL_ALEXA_SECRET` + `VIRGIL_ALEXA_USER_ID` | `CaptureIntent` then `StatusIntent` | `403 alexa_disabled`, `401 unauthorized`, `500 alexa_misconfigured` or safe speech fallback |

---

## Input-loop metrics (minimum)

Track these before optimizing UI or adding channels:

1. **Capture volume/day** — count new memory rows by channel/source metadata.
2. **Capture -> review conversion** — share of captured items that appear in a review surface (chat recap, daily digest, night insights, wiki ingest/log).
3. **Capture -> act signal** — share of captured items that later map to a delegated action/proposal/reminder.

Suggested observation points:

- Database (`Memory`, proposal/reminder/pending-intent tables) with channel metadata (`source`, `metadata.channel`, ingest type).
- Route-level logs for non-2xx responses on ingest/share/alexa/email.
- Daily operator checks in digest + night-review outputs to confirm captured notes are surfacing.

Simple SQL starter queries (adapt table names as needed):

```sql
-- Capture volume by source (last 7 days)
select
  coalesce(metadata->>'channel', metadata->>'source', 'unknown') as source,
  date_trunc('day', createdAt) as day,
  count(*) as captures
from "Memory"
where createdAt >= now() - interval '7 days'
group by 1, 2
order by day desc, captures desc;
```

```sql
-- Capture-to-action proxy: memories vs pending intents created (last 7 days)
select
  (select count(*) from "Memory" where createdAt >= now() - interval '7 days') as memory_captures,
  (select count(*) from "PendingIntent" where createdAt >= now() - interval '7 days') as delegated_actions;
```

---

## Check-in rhythm (product semantics)

| Cadence | Mechanism | Purpose |
|---------|-----------|---------|
| **Daily (morning)** | `GET /api/digest` (08:00 UTC on Vercel) | Email + optional **Slack** mirror of last-24h memories / proposals. |
| **Nightly** | `GET /api/night-review/enqueue` → worker | Deeper rollup; optional email on findings; `Memory` with `metadata.source = night-review`. |
| **Weekly** | Chat + [`/api/goal-guidance/weekly`](../app/(chat)/api/goal-guidance/weekly/route.ts) (GET/POST, session auth) | Structured metrics / snapshots; prompt templates in `lib/ai/goal-guidance-prompt.ts`. |

Digest and night review **complement** each other; neither replaces the other without an explicit product change.

---

## Failure drill: digest delivery degradation

Use this when cron succeeds but owners report missing daily digest/slack posts.

### Symptom

- `GET /api/digest` returns `200`, but output summary shows non-zero `emailFailures`, `slackFailures`, or `ownerFailures`.

### What to check (in order)

1. **Cron auth and trigger path**
 - Confirm request includes `Authorization: Bearer $CRON_SECRET`.
 - Re-run manually in non-production:
   - `curl -sS -H "Authorization: Bearer $CRON_SECRET" "$APP_URL/api/digest"`
2. **Route diagnostics payload**
 - Inspect `summary` and `failures` fields:
   - `ownersScanned`, `ownersProcessed`, `ownersSkippedNoData`
   - `emailSent` vs `emailFailures`
   - `slackPosted` vs `slackFailures`
   - `ownerFailures` (`stage: fetch|email|slack`)
3. **Email provider path**
 - Verify `RESEND_API_KEY` is present on the running host.
 - If `emailFailures > 0`, validate sender domain / provider status.
4. **Slack mirror path**
 - Verify either `VIRGIL_SLACK_CHECKIN_WEBHOOK_URL` or (`SLACK_BOT_TOKEN` + `VIRGIL_SLACK_CHECKIN_CHANNEL_ID`).
 - If `slackFailures > 0` with email success, treat Slack as degraded mirror path; digest email remains primary.
5. **Owner data eligibility**
 - If `ownersSkippedNoData` is high, this is expected when no memories/proposals exist in the window.

### Recovery actions

- Fix missing/bad env vars on the active host and restart app process.
- Re-run `GET /api/digest` manually once to verify summary counters improve.
- If only one stage fails, keep service running and open a targeted follow-up (email provider vs Slack integration) instead of disabling the whole cron loop.

---

## Failure drill: night-review enqueue backlog / publish failures

Use this when night review appears idle or only some owners get runs.

### Symptom

- `GET /api/night-review/enqueue` returns `200`, but summary shows `publishFailures > 0` or `enqueued` lower than expected.

### What to check (in order)

1. **Cron auth and slot gating**
 - Confirm `Authorization: Bearer $CRON_SECRET`.
 - If response shows `skipped: true`:
   - `reason: disabled` -> check `NIGHT_REVIEW_ENABLED`
   - `reason: outside_off_peak_slot` -> verify timezone/off-peak config (`NIGHT_REVIEW_TIMEZONE`, off-peak hour envs)
2. **Model allowlist gate**
 - `reason: night_review_model_not_allowed` means `NIGHT_REVIEW_MODEL` is outside allowed ids (`ollama/...` or configured supported set per docs).
3. **QStash wiring**
 - Ensure `QSTASH_TOKEN` exists on the running host.
 - If `publishFailures > 0`, inspect `failures[]` by `ownerId` and retry after token/region fix (`QSTASH_URL` if region mismatch).
4. **Owner eligibility**
 - Compare `ownersScanned`, `guestOwnersSkipped`, and `eligibleOwners`.
 - High guest skip count is expected when many guest rows exist.

### Recovery actions

- Fix env/config, restart app process, then manually re-run enqueue in non-production:
 - `curl -sS -H "Authorization: Bearer $CRON_SECRET" "$APP_URL/api/night-review/enqueue"`
- Confirm `publishFailures` drops and `enqueued` increases.
- If failures remain owner-specific, inspect that owner's chat/history eligibility and queue visibility before escalating to scheduler changes.

---

## Failure drill: background job worker run failures

Use this when queued jobs remain pending/retrying or worker execution fails.

### Symptom

- `POST /api/background/jobs/run` returns non-2xx, or returns `ok: false` with `job_processing_failed`.

### What to check (in order)

1. **QStash request verification**
 - `qstash_signing_keys_missing` -> set `QSTASH_CURRENT_SIGNING_KEY` and `QSTASH_NEXT_SIGNING_KEY`.
 - `missing_signature` / `invalid_signature` -> verify request came from QStash and signature header is intact.
2. **Payload shape**
 - `invalid_json` or `missing_job_id` -> publisher payload malformed; inspect enqueue publisher body.
3. **Job execution**
 - `job_processing_failed` with `jobId` -> inspect job-specific handler/logs for that id.

### Retry semantics

- Worker route is idempotent per `jobId` contract: rerun should be safe after root cause fix.
- Preferred recovery flow:
  1. fix config/dependency failure
  2. re-dispatch the same `jobId` through queue trigger path
  3. verify route returns `{ ok: true, jobId }`
- Avoid bypassing queue policy by inventing ad-hoc job payloads; always retry via the canonical job id.

---

## Operator flight deck

The **flight deck** triage block lives on **[`/command-center`](../app/(chat)/command-center/page.tsx)** (`?section=triage`; legacy `/flight-deck` redirects there). It is backed by `GET /api/flight-deck` and composes **chat path telemetry** (fallback/error rates over rolling windows) and **background queue health** (pending/running/failed job counts). It is meant to shorten “what is on fire?” time before you scroll to the **Background** section on the same page.

### Permissions and routes

| Surface | Who | Notes |
|---------|-----|--------|
| UI `/command-center` | Signed-in (non-guest) | Combines triage, background activity, and daily Sophon; guests are redirected to login. |
| `GET /api/flight-deck` | Signed-in **regular** (`user.type === "regular"`) | Returns `summary`, `cards[]`, optional `sourceErrors` when a data source fails. |
| `POST /api/flight-deck/actions/digest` | **`operator` or `admin` role** (`User.role`) | One-click **manual digest**; requires `CRON_SECRET` on the server, same-origin browser request, idempotency + action-token headers, cooldown, and single-flight protection. Writes audit rows to `FlightDeckOperatorAudit`. |

Promote a user to operator in Postgres (one-off; adjust email):

```sql
update "User" set role = 'operator' where email = 'you@example.com';
```

Valid roles in app code: `user` (default), `operator`, `admin`.

### One-click manual digest

Use when the daily digest path is healthy but you want an **immediate** run (for example after fixing `RESEND_API_KEY` or Slack mirror config). The action invokes the same digest logic as `GET /api/digest` internally (Bearer `CRON_SECRET`); it does **not** expose the cron secret to the browser.

On failure, the JSON body may include a `recoveryHint` and `requestId`. Cross-check:

- [Failure drill: digest delivery degradation](#failure-drill-digest-delivery-degradation) — email/Slack/summary counters.
- `GET /api/digest` with `Authorization: Bearer $CRON_SECRET` for raw diagnostics (operator shell / trusted host only).

### Card → runbook mapping

Use this table when a card is **degraded**, **high/critical** severity, or **stale**. Deterministic ordering and fields are implemented in `lib/reliability/flight-deck-handler.ts` and `lib/reliability/flight-deck-signals.ts`.

<a id="flight-deck-chat-fallback-card"></a>

#### Chat fallback card (`chat_fallback`)

- **Meaning:** Elevated errors or fallback usage on chat paths (hosted gateway vs local Ollama vs fallbacks) inside the current/trend windows.
- **Deep link in UI:** `/command-center?section=background` (queue and job context on the same page).
- **What to do next:**
  1. Confirm recent chat traffic: send a short hosted-model message and a local-model message if you use Ollama.
  2. Turn on structured traces for one repro: `V2_TRACE_LOGGING=true` (see [STABILITY_TRACK.md](STABILITY_TRACK.md) § Commands).
  3. Re-read gateway vs local posture in [README.md](../README.md) (Troubleshooting local models) and [AGENTS.md](../AGENTS.md) (chat fallback envs).
  4. If errors cluster on one path, narrow to provider vs Ollama reachability vs rate limits—do **not** treat the card as a digest failure.

<a id="flight-deck-queue-health-card"></a>

#### Queue and job health card (`queue_health`)

- **Meaning:** Pending/running/failed background jobs visible in the snapshot window.
- **Deep link in UI:** `/command-center?section=background`.
- **What to do next:** Follow [Failure drill: background job worker run failures](#failure-drill-background-job-worker-run-failures) (QStash verification, signing keys, job id retries).

#### Stale data or `confidence: unknown`

- **Meaning:** Telemetry or queue snapshot is missing or older than the freshness window—**investigate data path before** blaming models.
- **What to do next:** Verify Postgres connectivity, migrations applied (`pnpm db:migrate`), and that chat traffic exists to populate `ChatPathTelemetry`. Then re-open the flight deck.

### Measurement (incident triage)

To track **time-to-first-correct-action** and **time-to-stable-state**, log a short row per incident (spreadsheet or ops doc). Suggested column names match `FLIGHT_DECK_MEASUREMENT_FIELDS` in `lib/reliability/flight-deck-metrics.ts`:

- `incident_id`, `flight_deck_opened_at`, `highest_severity_card_type`, `highest_severity_level`, `summary_confidence_at_open`
- `first_runbook_section_opened_at`, `minutes_to_first_correct_action`, `stable_state_observed_at`
- `digest_manual_run_request_id` (from the one-click action response when used)
- `notes`

---

## Related docs

- [integration-test-matrix.md](integration-test-matrix.md) — regression-style matrix.
- [manos-performance.md](manos-performance.md) — LAN inference tuning for **virgil-manos**.
- [alexa-channel.md](alexa-channel.md) — Alexa webhook bridge contract and Lambda forwarder example.
