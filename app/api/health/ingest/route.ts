import { z } from "zod";
import { insertHealthSnapshot } from "@/lib/db/queries";
import { isVirgilHealthIngestEnabled } from "@/lib/virgil/integrations";

/**
 * iOS/watchOS companion: POST JSON batches from HealthKit.
 * Auth: Authorization: Bearer $VIRGIL_HEALTH_INGEST_SECRET
 * Target user: VIRGIL_HEALTH_INGEST_USER_ID (single-owner deployments).
 */
const bodySchema = z.object({
  periodStart: z.string().min(1),
  periodEnd: z.string().min(1),
  source: z.string().max(64).optional().default("apple-health"),
  payload: z.record(z.string(), z.unknown()),
});

export async function POST(request: Request) {
  if (!isVirgilHealthIngestEnabled()) {
    return Response.json({ error: "health_ingest_disabled" }, { status: 403 });
  }

  const secret = process.env.VIRGIL_HEALTH_INGEST_SECRET?.trim();
  const userId = process.env.VIRGIL_HEALTH_INGEST_USER_ID?.trim();
  if (!secret || !userId) {
    return Response.json(
      { error: "health_ingest_misconfigured" },
      { status: 500 }
    );
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

  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: "invalid_body" }, { status: 400 });
  }

  const periodStart = new Date(parsed.data.periodStart);
  const periodEnd = new Date(parsed.data.periodEnd);
  if (
    Number.isNaN(periodStart.getTime()) ||
    Number.isNaN(periodEnd.getTime())
  ) {
    return Response.json({ error: "invalid_dates" }, { status: 400 });
  }
  if (periodEnd.getTime() < periodStart.getTime()) {
    return Response.json({ error: "period_end_before_start" }, { status: 400 });
  }

  const row = await insertHealthSnapshot({
    userId,
    periodStart,
    periodEnd,
    source: parsed.data.source,
    payload: parsed.data.payload,
  });

  return Response.json({ snapshot: row });
}
