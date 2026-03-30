import { Receiver } from "@upstash/qstash";
import { NextResponse } from "next/server";
import { runAgentTaskTriage } from "@/lib/agent-tasks/triage-worker";

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

  try {
    const result = await runAgentTaskTriage();
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    console.error("Agent task triage failed:", error);
    return NextResponse.json(
      { ok: false, error: String(error) },
      { status: 500 }
    );
  }
}
