# Google Calendar (v1, read-only)

Virgil can read the **primary** Google Calendar for the **single OAuth identity** stored in server environment variables. This is **not** per-user Google sign-in: one refresh token in env backs all calendar reads (fits the bespoke single-owner product).

## Behavior

| Surface | What happens |
|---------|----------------|
| **Chat tool** `listCalendarEvents` | Calls the Calendar API when `VIRGIL_CALENDAR_INTEGRATION=1` and `GOOGLE_CALENDAR_*` secrets are set. Returns timed and all-day events for a configurable day window (default **7** days ahead, max **21**). Implementation: [`lib/ai/tools/calendar.ts`](../lib/ai/tools/calendar.ts). |
| **REST** | `GET /api/calendar/status` — feature flag + whether OAuth env is complete (session auth, not guests). `GET /api/calendar/events?timeMin=&timeMax=` — raw events JSON (optional query overrides window). Routes live under `app/(chat)/api/calendar/` (see [`events/route.ts`](../app/%28chat%29/api/calendar/events/route.ts)). |
| **Core API** | Token refresh + list events: [`lib/integrations/google-calendar-readonly.ts`](../lib/integrations/google-calendar-readonly.ts). Feature gate: [`lib/virgil/integrations.ts`](../lib/virgil/integrations.ts) (`isVirgilCalendarIntegrationEnabled`). |

### Chat path limitations (important)

- **Hosted AI Gateway / non-Ollama models:** `listCalendarEvents` is included with the companion tool bundle in [`app/(chat)/api/chat/route.ts`](../app/%28chat%29/api/chat/route.ts) (same pattern as Jira, memory tools, etc.).
- **Local Ollama:** the chat route does **not** register the full companion tool set on the primary local branch (by design — small-model reliability and context). Calendar in **chat** does **not** run on pure local Ollama today. Use a gateway model for “what’s on my calendar?” in chat, or call the **REST** routes from scripts/UI while signed in.
- **Fallback:** if `VIRGIL_CHAT_FALLBACK=1` escalates from failed local to Gemini/Gateway, the escalated path **does** use companion tools — calendar works there if env is set.
- **Reasoning / no-tools gateway models:** same rule as other tools — if the model is treated as “no tools,” `experimental_activeTools` can be empty and **no** tools run. Pick a tool-capable gateway model to use calendar in chat.

## How to turn it on

### 1. Google Cloud project

1. Open [Google Cloud Console](https://console.cloud.google.com/) and select or create a project.
2. **APIs & Services → Library** — enable **Google Calendar API**.
3. **APIs & Services → OAuth consent screen** — configure (app name, support email, scopes). Add scope **`https://www.googleapis.com/auth/calendar.readonly`** (read-only).
4. **APIs & Services → Credentials → Create credentials → OAuth client ID**.
   - **Desktop app** or **Web application** both work; Desktop is often simpler for one-off “get a refresh token” flows.
   - Note the **Client ID** and **Client secret**.

### 2. Obtain a refresh token

You need a **long-lived refresh token** for the Google account whose **primary** calendar Virgil should read.

Google’s documentation: [Calendar API — Authorize requests](https://developers.google.com/calendar/api/guides/auth) and [Using OAuth 2.0 for Web Server Applications](https://developers.google.com/identity/protocols/oauth2/web-server) (or installed-app flow for Desktop clients).

Practical pattern:

1. Run an OAuth flow (browser or device) that requests `calendar.readonly` and your client ID/secret.
2. Complete consent as the target Google user.
3. Exchange the authorization **code** for tokens; copy the **`refresh_token`** from the response (store it like a password).

There is **no** refresh-token wizard shipped in this repo; many teams use a short local script with `google-auth-library`, the [OAuth 2.0 Playground](https://developers.google.com/oauthplayground/) (with your own client credentials), or Google’s sample flows. **Revoke** test tokens if you expose a client secret during experiments.

### 3. Environment variables

Set in **`.env.local`** (local) and in **Vercel / host env** (production) when deployed:

| Variable | Required | Description |
|----------|----------|-------------|
| `VIRGIL_CALENDAR_INTEGRATION` | Yes | Must be `1` to enable routes and the chat tool path. |
| `GOOGLE_CALENDAR_CLIENT_ID` | Yes | OAuth client ID from Google Cloud. |
| `GOOGLE_CALENDAR_CLIENT_SECRET` | Yes | OAuth client secret. |
| `GOOGLE_CALENDAR_REFRESH_TOKEN` | Yes | Refresh token with `calendar.readonly` scope. |

Also documented in [`.env.example`](../.env.example) and [AGENTS.md — env summary](../AGENTS.md#deployment-production).

Restart the dev server or redeploy after changes.

### 4. Verify

1. Sign in to Virgil as a **non-guest** user (same as normal chat).
2. In the browser (same origin as the app), open:
   - `/api/calendar/status` — expect `"ready": true` when the flag and secrets are set.
   - `/api/calendar/events` — expect `{ "events": [ … ] }` or an empty list if the window has no events.
3. In chat, use a **tool-capable gateway model** and ask for upcoming events; the model should call `listCalendarEvents`.

If `status` shows `secretsReady: false`, one of the three `GOOGLE_CALENDAR_*` values is missing or blank. If `ready` is false but `secretsReady` is true, set `VIRGIL_CALENDAR_INTEGRATION=1`.

## Security notes

- Treat **`GOOGLE_CALENDAR_REFRESH_TOKEN`** like a password: never commit it, never paste into issues or chat logs.
- **Guests** receive **403** on calendar routes.
- Calendar data leaves Google only to your server and then to authenticated responses / tool results — align retention and logging with your threat model.

---

## Handoff for the next agent / planning session

Copy or adapt this block when starting a new chat.

**Goal:** v1 Google Calendar is **read-only**, **primary calendar only**, **env-scoped OAuth** (single account).

**Implemented (code pointers)**

- [`lib/integrations/google-calendar-readonly.ts`](../lib/integrations/google-calendar-readonly.ts) — refresh access token, `listPrimaryCalendarEvents`.
- [`lib/ai/tools/calendar.ts`](../lib/ai/tools/calendar.ts) — `listCalendarEvents` tool (wired to integration; structured errors when disabled).
- [`app/(chat)/api/calendar/status/route.ts`](../app/%28chat%29/api/calendar/status/route.ts), [`events/route.ts`](../app/%28chat%29/api/calendar/events/route.ts) — session-authenticated JSON API.
- [`lib/ai/companion-prompt.ts`](../lib/ai/companion-prompt.ts) — companion guidance for the calendar tool.

**Not in scope / known gaps (good planning fodder)**

- No **per-user** Google OAuth in the UI; all users share one calendar identity if env is set (acceptable for single-owner; wrong for multi-tenant).
- **No writes** (no create/update events) in v1.
- **Only `primary`** calendar — no multi-calendar selection in env or API.
- **Local Ollama default chat branch** does not expose companion tools — calendar in chat is gateway/fallback-oriented unless the route is changed intentionally (see [docs/tickets/2026-03-28-ollama-local-model.md](tickets/2026-03-28-ollama-local-model.md) for tool policy context).
- [`docs/PIVOT_EVENTS_AND_NUDGES.md`](PIVOT_EVENTS_AND_NUDGES.md) still mentions calendar stubs in places — reconcile when event producers ship.

**Suggested verification before claiming calendar work**

- `pnpm check`, `pnpm run type-check`
- Manual: `/api/calendar/status` + gateway chat asking for “events this week”

**Full setup walkthrough:** this document (top sections).

## Related

- [docs/github-product-opportunity.md](github-product-opportunity.md) — pattern for optional integration docs + gateway tool caveats  
- [docs/PROJECT.md](PROJECT.md) — documentation map and generic agent handoff  
- [AGENTS.md](../AGENTS.md) — setup checklist § 1.10, deployment env table  
