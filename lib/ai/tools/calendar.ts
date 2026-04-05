import { tool } from "ai";
import { z } from "zod";

import {
  type CalendarEventSummary,
  isGoogleCalendarSecretsConfigured,
  listPrimaryCalendarEvents,
} from "@/lib/integrations/google-calendar-readonly";
import { isVirgilCalendarIntegrationEnabled } from "@/lib/virgil/integrations";

const MS_PER_DAY = 24 * 60 * 60 * 1000;

function summarizeEventForModel(ev: CalendarEventSummary) {
  const allDay = Boolean(ev.start?.date && !ev.start?.dateTime);
  const start = ev.start?.dateTime ?? ev.start?.date ?? "";
  const end = ev.end?.dateTime ?? ev.end?.date ?? "";
  return {
    summary: ev.summary ?? "(no title)",
    start,
    end,
    allDay,
    ...(ev.status ? { status: ev.status } : {}),
  };
}

export const listCalendarEvents = tool({
  description:
    "List upcoming events from the user's primary Google Calendar. Use when the user asks about their schedule, meetings, or what's on today or this week.",
  inputSchema: z.object({
    daysAhead: z
      .number()
      .min(1)
      .max(21)
      .optional()
      .default(7)
      .describe("How many days forward from now to include (1–21). Default 7."),
  }),
  execute: async ({ daysAhead = 7 }) => {
    if (!isVirgilCalendarIntegrationEnabled()) {
      return {
        error: "calendar_integration_disabled",
        hint: "Server admin must set VIRGIL_CALENDAR_INTEGRATION=1.",
      };
    }
    if (!isGoogleCalendarSecretsConfigured()) {
      return {
        error: "calendar_oauth_incomplete",
        hint: "Set GOOGLE_CALENDAR_CLIENT_ID, GOOGLE_CALENDAR_CLIENT_SECRET, and GOOGLE_CALENDAR_REFRESH_TOKEN (calendar.readonly scope).",
      };
    }

    const now = new Date();
    const timeMinIso = now.toISOString();
    const timeMaxIso = new Date(
      now.getTime() + daysAhead * MS_PER_DAY
    ).toISOString();

    try {
      const raw = await listPrimaryCalendarEvents({
        timeMinIso,
        timeMaxIso,
      });
      const events = raw.map(summarizeEventForModel);
      return {
        timeMin: timeMinIso,
        timeMax: timeMaxIso,
        count: events.length,
        events,
      };
    } catch (e) {
      const message = e instanceof Error ? e.message : "unknown_error";
      return {
        error: "calendar_fetch_failed",
        message,
      };
    }
  },
});
