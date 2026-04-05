import { persistGeneralIngest } from "@/lib/ingest/general-ingest";
import { virgilGeneralIngestBodySchema } from "@/lib/ingest/virgil-general-ingest-schema";
import { isVirgilIngestEnabled } from "@/lib/virgil/integrations";

/**
 * General context ingress (shortcuts, scripts, PWA share target server path uses session).
 * Auth: `Authorization: Bearer $VIRGIL_INGEST_SECRET`
 * Target user: `VIRGIL_INGEST_USER_ID` (single-owner).
 */
export async function POST(request: Request) {
  if (!isVirgilIngestEnabled()) {
    return Response.json({ error: "ingest_disabled" }, { status: 403 });
  }

  const secret = process.env.VIRGIL_INGEST_SECRET?.trim();
  const userId = process.env.VIRGIL_INGEST_USER_ID?.trim();
  if (!secret || !userId) {
    return Response.json({ error: "ingest_misconfigured" }, { status: 500 });
  }

  const auth = request.headers.get("authorization");
  if (auth !== `Bearer ${secret}`) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "invalid_json" }, { status: 400 });
  }

  const parsed = virgilGeneralIngestBodySchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: "invalid_body" }, { status: 400 });
  }

  const row = await persistGeneralIngest({
    userId,
    body: parsed.data,
  });

  return Response.json({ memory: row });
}
