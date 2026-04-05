import { auth } from "@/app/(auth)/auth";
import { listPrimaryCalendarEvents } from "@/lib/integrations/google-calendar-readonly";
import { isVirgilCalendarIntegrationEnabled } from "@/lib/virgil/integrations";

/**
 * Read-only primary calendar events (RFC3339 timeMin/timeMax).
 * Requires VIRGIL_CALENDAR_INTEGRATION=1 and Google OAuth refresh token env. See AGENTS.md.
 */
export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }
  if (session.user.type === "guest") {
    return Response.json({ error: "forbidden" }, { status: 403 });
  }

  if (!isVirgilCalendarIntegrationEnabled()) {
    return Response.json(
      { error: "calendar_integration_disabled" },
      { status: 403 }
    );
  }

  const { searchParams } = new URL(request.url);
  const now = new Date();
  const weekAhead = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  const timeMin = searchParams.get("timeMin") ?? now.toISOString();
  const timeMax = searchParams.get("timeMax") ?? weekAhead.toISOString();

  try {
    const events = await listPrimaryCalendarEvents({
      timeMinIso: timeMin,
      timeMaxIso: timeMax,
    });
    return Response.json({ events, timeMin, timeMax });
  } catch (e) {
    const message = e instanceof Error ? e.message : "calendar_request_failed";
    return Response.json(
      { error: "calendar_upstream_error", message },
      { status: 502 }
    );
  }
}
