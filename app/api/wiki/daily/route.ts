import { runDailyWikiMaintenance } from "@/lib/wiki/service";

function wikiDailyEnabled(): boolean {
  return process.env.VIRGIL_WIKI_DAILY_ENABLED === "1";
}

function cronAuthorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) {
    return false;
  }
  return request.headers.get("authorization") === `Bearer ${secret}`;
}

/**
 * Optional daily wiki maintenance trigger.
 * Requires VIRGIL_WIKI_DAILY_ENABLED=1 and Authorization: Bearer $CRON_SECRET.
 */
export async function GET(request: Request) {
  if (!wikiDailyEnabled()) {
    return Response.json({ error: "wiki_daily_disabled" }, { status: 403 });
  }
  if (!cronAuthorized(request)) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  try {
    const result = await runDailyWikiMaintenance();
    return Response.json(result);
  } catch (error) {
    return Response.json(
      {
        error: "wiki_daily_failed",
        detail: error instanceof Error ? error.message : "unknown_error",
      },
      { status: 500 }
    );
  }
}
