import { Receiver } from "@upstash/qstash";
import { NextResponse } from "next/server";
import {
  type NightReviewWorkerPayload,
  runNightReviewForUser,
} from "@/lib/night-review/run-night-review";

export const maxDuration = 300;

export async function POST(request: Request) {
  const currentSigningKey = process.env.QSTASH_CURRENT_SIGNING_KEY;
  const nextSigningKey = process.env.QSTASH_NEXT_SIGNING_KEY;
  if (!(currentSigningKey && nextSigningKey)) {
    return new Response("QStash signing keys not configured", { status: 500 });
  }

  const receiver = new Receiver({
    currentSigningKey,
    nextSigningKey,
  });

  const body = await request.text();
  const signature = request.headers.get("upstash-signature");

  if (!signature) {
    return new Response("Missing signature", { status: 401 });
  }

  const isValid = await receiver.verify({ body, signature }).catch(() => false);
  if (!isValid) {
    return new Response("Invalid signature", { status: 401 });
  }

  let payload: NightReviewWorkerPayload;
  try {
    payload = JSON.parse(body) as NightReviewWorkerPayload;
  } catch {
    return new Response("Invalid JSON", { status: 400 });
  }

  if (
    !payload.userId ||
    !payload.windowStart ||
    !payload.windowEnd ||
    !payload.runId ||
    !payload.windowKey
  ) {
    return new Response("Missing required fields", { status: 400 });
  }

  try {
    const result = await runNightReviewForUser(payload);
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    console.error("Night review run failed:", error);
    return NextResponse.json(
      { ok: false, error: String(error) },
      { status: 500 }
    );
  }
}
