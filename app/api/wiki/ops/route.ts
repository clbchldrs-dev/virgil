import { z } from "zod";
import { ingestWikiSource, lintWiki, queryWiki } from "@/lib/wiki/service";

const bodySchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("ingest"),
    sourceRelativePath: z.string().min(1),
  }),
  z.object({
    action: z.literal("query"),
    query: z.string().min(1),
  }),
  z.object({
    action: z.literal("lint"),
  }),
]);

function wikiOpsEnabled(): boolean {
  return process.env.VIRGIL_WIKI_OPS_ENABLED === "1";
}

function cronAuthorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) {
    return false;
  }
  return request.headers.get("authorization") === `Bearer ${secret}`;
}

/**
 * Manual admin-only wiki operations for the Virgil 1.1 bridge.
 * Requires: VIRGIL_WIKI_OPS_ENABLED=1 and Authorization: Bearer $CRON_SECRET
 */
export async function POST(request: Request) {
  if (!wikiOpsEnabled()) {
    return Response.json({ error: "wiki_ops_disabled" }, { status: 403 });
  }
  if (!cronAuthorized(request)) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "invalid_json" }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: "invalid_body" }, { status: 400 });
  }

  try {
    if (parsed.data.action === "ingest") {
      const result = await ingestWikiSource(parsed.data.sourceRelativePath);
      return Response.json(result);
    }
    if (parsed.data.action === "query") {
      const result = await queryWiki(parsed.data.query);
      return Response.json(result);
    }
    const result = await lintWiki();
    return Response.json(result);
  } catch (error) {
    return Response.json(
      {
        error: "wiki_operation_failed",
        detail: error instanceof Error ? error.message : "unknown_error",
      },
      { status: 500 }
    );
  }
}
