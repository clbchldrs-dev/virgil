import "server-only";

/**
 * Read-only Google Calendar (primary calendar) using a long-lived refresh token.
 * Set VIRGIL_CALENDAR_INTEGRATION=1 plus client id/secret/refresh token. See AGENTS.md.
 */

export function isGoogleCalendarSecretsConfigured(): boolean {
  return Boolean(
    process.env.GOOGLE_CALENDAR_CLIENT_ID?.trim() &&
      process.env.GOOGLE_CALENDAR_CLIENT_SECRET?.trim() &&
      process.env.GOOGLE_CALENDAR_REFRESH_TOKEN?.trim()
  );
}

type TokenResponse = {
  access_token?: string;
  error?: string;
  error_description?: string;
};

export async function getGoogleCalendarAccessToken(): Promise<string> {
  const clientId = process.env.GOOGLE_CALENDAR_CLIENT_ID?.trim();
  const clientSecret = process.env.GOOGLE_CALENDAR_CLIENT_SECRET?.trim();
  const refreshToken = process.env.GOOGLE_CALENDAR_REFRESH_TOKEN?.trim();
  if (!clientId || !clientSecret || !refreshToken) {
    throw new Error("Google Calendar OAuth env is incomplete");
  }

  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    refresh_token: refreshToken,
    grant_type: "refresh_token",
  });

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });

  const data = (await res.json()) as TokenResponse;
  if (!res.ok || !data.access_token) {
    const detail = data.error_description ?? data.error ?? res.statusText;
    throw new Error(`Google token refresh failed: ${detail}`);
  }
  return data.access_token;
}

type CalendarListResponse = {
  items?: Array<{
    id?: string;
    summary?: string;
    start?: { dateTime?: string; date?: string };
    end?: { dateTime?: string; date?: string };
    status?: string;
  }>;
  error?: { message?: string };
};

export type CalendarEventSummary = NonNullable<
  CalendarListResponse["items"]
>[number];

export async function listPrimaryCalendarEvents({
  timeMinIso,
  timeMaxIso,
}: {
  timeMinIso: string;
  timeMaxIso: string;
}): Promise<CalendarEventSummary[]> {
  const token = await getGoogleCalendarAccessToken();
  const params = new URLSearchParams({
    timeMin: timeMinIso,
    timeMax: timeMaxIso,
    singleEvents: "true",
    orderBy: "startTime",
  });
  const url = `https://www.googleapis.com/calendar/v3/calendars/primary/events?${params.toString()}`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const json = (await res.json()) as CalendarListResponse;
  if (!res.ok) {
    const msg = json.error?.message ?? res.statusText;
    throw new Error(`Calendar API error: ${msg}`);
  }
  return json.items ?? [];
}
