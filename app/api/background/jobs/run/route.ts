import { Receiver } from "@upstash/qstash";
import { NextResponse } from "next/server";
import { processBackgroundJobById } from "@/lib/background-jobs/process-job";

export const maxDuration = 120;

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

  let payload: { jobId?: string };
  try {
    payload = JSON.parse(body) as { jobId?: string };
  } catch {
    return new Response("Invalid JSON", { status: 400 });
  }

  if (!payload.jobId || typeof payload.jobId !== "string") {
    return new Response("Missing jobId", { status: 400 });
  }

  await processBackgroundJobById(payload.jobId);
  return NextResponse.json({ ok: true });
}
