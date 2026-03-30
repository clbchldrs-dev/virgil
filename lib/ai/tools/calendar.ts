import { tool } from "ai";
import { z } from "zod";

// TODO: Implement Google Calendar API — requires OAuth2 credentials:
// GOOGLE_CALENDAR_CLIENT_ID, GOOGLE_CALENDAR_CLIENT_SECRET, GOOGLE_CALENDAR_REFRESH_TOKEN

export const listCalendarEvents = tool({
  description: "List upcoming calendar events for a given date range.",
  inputSchema: z.object({
    daysAhead: z
      .number()
      .optional()
      .default(1)
      .describe("Number of days ahead to look"),
  }),
  execute: async () => {
    return {
      error: "Calendar integration not yet configured. Needs OAuth setup.",
    };
  },
});
