import { parseJournal } from "@/lib/journal/parse-journal";
import { getNightReviewTimezone } from "@/lib/night-review/config";
import { isVirgilJournalFileParseEnabled } from "@/lib/virgil/integrations";

function cronAuthorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) {
    return false;
  }
  const auth = request.headers.get("authorization");
  return auth === `Bearer ${secret}`;
}

/**
 * Self-hosted cron: `GET` with `Authorization: Bearer $CRON_SECRET`.
 * Optional `POST` JSON `{ "content": "…" }` with the same auth when the filesystem is unavailable (e.g. Vercel).
 */
export async function GET(request: Request) {
  if (!isVirgilJournalFileParseEnabled()) {
    return Response.json({ error: "journal_parse_disabled" }, { status: 403 });
  }
  if (!cronAuthorized(request)) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  const userId = process.env.VIRGIL_INGEST_USER_ID?.trim();
  if (!userId) {
    return Response.json(
      { error: "ingest_user_misconfigured" },
      { status: 500 }
    );
  }

  const tz = getNightReviewTimezone();
  const result = await parseJournal({ userId, timeZone: tz });
  return Response.json({
    created: result.created,
    skippedReason: result.skippedReason,
  });
}

export async function POST(request: Request) {
  if (!isVirgilJournalFileParseEnabled()) {
    return Response.json({ error: "journal_parse_disabled" }, { status: 403 });
  }
  if (!cronAuthorized(request)) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  const userId = process.env.VIRGIL_INGEST_USER_ID?.trim();
  if (!userId) {
    return Response.json(
      { error: "ingest_user_misconfigured" },
      { status: 500 }
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "invalid_json" }, { status: 400 });
  }

  const content =
    typeof body === "object" &&
    body !== null &&
    "content" in body &&
    typeof (body as { content: unknown }).content === "string"
      ? (body as { content: string }).content
      : null;

  if (!content?.trim()) {
    return Response.json({ error: "missing_content" }, { status: 400 });
  }

  const tz = getNightReviewTimezone();
  const result = await parseJournal({
    userId,
    journalTextOverride: content,
    timeZone: tz,
  });
  return Response.json({
    created: result.created,
    skippedReason: result.skippedReason,
  });
}
