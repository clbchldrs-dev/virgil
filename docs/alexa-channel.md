# Alexa channel (v1, Phase 1 MVP)

Virgil can accept Alexa requests through a dedicated webhook route:

- `POST /api/channels/alexa`

This is a **single-owner** channel adapter. Alexa is treated as a thin I/O surface; Virgil remains the backend brain.

## What it supports now

| Intent / request | Behavior |
|---|---|
| `LaunchRequest` | Intro + reprompt |
| `AMAZON.HelpIntent` | Help copy + reprompt |
| `CaptureIntent` | Saves a note to `Memory` using existing ingest path (`source: "alexa"`) |
| `StatusIntent` | Reads last 7 days of memories (up to 3 rows) and returns a short spoken summary |
| `SessionEndedRequest` | Ends session cleanly |

Route implementation: [`app/api/channels/alexa/route.ts`](../app/api/channels/alexa/route.ts).

## Required env vars

Set these where the Next.js server runs (`.env.local`, `.env.docker`, or production env):

| Variable | Required | Purpose |
|---|---|---|
| `VIRGIL_ALEXA_ENABLED` | Yes | Must be `1` to enable the route |
| `VIRGIL_ALEXA_SECRET` | Yes | Bearer secret expected by the route |
| `VIRGIL_ALEXA_USER_ID` | Yes | `User.id` UUID for single-owner memory writes/reads |

Also listed in [`.env.example`](../.env.example) and [AGENTS.md env summary](../AGENTS.md#deployment-production).

## Request contract

### Auth

Include:

- `Authorization: Bearer <VIRGIL_ALEXA_SECRET>`

### Body

Alexa request envelope JSON (minimum fields used by Virgil):

```json
{
  "request": {
    "type": "IntentRequest",
    "intent": {
      "name": "CaptureIntent",
      "slots": {
        "note": { "name": "note", "value": "buy dog food" }
      }
    }
  },
  "session": {
    "sessionId": "SessionId.xxx",
    "user": { "userId": "amzn1.ask.account.xxx" }
  }
}
```

Virgil checks these slot keys first for `CaptureIntent`: `note`, `content`, `text`, `capture`; then falls back to first slot with a value.

## Response contract

Response is Alexa-compatible plain text speech:

```json
{
  "version": "1.0",
  "response": {
    "outputSpeech": {
      "type": "PlainText",
      "text": "Saved. I captured that note."
    },
    "shouldEndSession": false
  }
}
```

## Alexa Skill intent names

Configure these names in the Alexa interaction model:

- `CaptureIntent`
- `StatusIntent`

You can keep standard intents (`AMAZON.HelpIntent`, etc.) as normal.

## Example Lambda forwarder

Use this if Alexa should hit Lambda first, and Lambda should forward to Virgil:

```ts
export const handler = async (event: unknown) => {
  const virgilUrl = process.env.VIRGIL_ALEXA_WEBHOOK_URL;
  const virgilSecret = process.env.VIRGIL_ALEXA_SECRET;

  if (!virgilUrl || !virgilSecret) {
    return {
      statusCode: 500,
      body: JSON.stringify({
        version: "1.0",
        response: {
          outputSpeech: {
            type: "PlainText",
            text: "Virgil bridge is not configured."
          },
          shouldEndSession: true
        }
      })
    };
  }

  const response = await fetch(virgilUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${virgilSecret}`
    },
    body: JSON.stringify(event)
  });

  if (!response.ok) {
    return {
      statusCode: 200,
      body: JSON.stringify({
        version: "1.0",
        response: {
          outputSpeech: {
            type: "PlainText",
            text: "Virgil is unavailable right now."
          },
          shouldEndSession: true
        }
      })
    };
  }

  const payload = await response.json();
  return {
    statusCode: 200,
    body: JSON.stringify(payload)
  };
};
```

Lambda env vars:

- `VIRGIL_ALEXA_WEBHOOK_URL=https://<your-host>/api/channels/alexa`
- `VIRGIL_ALEXA_SECRET=<same as server>`

## Smoke test with curl

From repo root (`virgil/`), test route wiring quickly:

```bash
curl -sS "http://localhost:3000/api/channels/alexa" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $VIRGIL_ALEXA_SECRET" \
  -d '{
    "request": {
      "type": "IntentRequest",
      "intent": {
        "name": "CaptureIntent",
        "slots": {
          "note": { "name": "note", "value": "Remember to review roadmap Friday" }
        }
      }
    },
    "session": {
      "sessionId": "SessionId.local",
      "user": { "userId": "amzn1.ask.account.local" }
    }
  }'
```

Then test status:

```bash
curl -sS "http://localhost:3000/api/channels/alexa" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $VIRGIL_ALEXA_SECRET" \
  -d '{
    "request": {
      "type": "IntentRequest",
      "intent": { "name": "StatusIntent" }
    }
  }'
```

## Security notes

- Keep `VIRGIL_ALEXA_SECRET` private and rotate if exposed.
- This MVP uses bearer-secret auth; it does **not** yet validate Amazon signature headers.
- Keep this channel single-owner via `VIRGIL_ALEXA_USER_ID` until per-user auth/account-linking is explicitly designed.
