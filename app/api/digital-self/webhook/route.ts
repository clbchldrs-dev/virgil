import { z } from "zod";

const payloadSchema = z.object({
  type: z.literal("digital-self.approval.queued"),
  approvalId: z.string().min(1),
  channel: z.string(),
  threadId: z.string(),
  preview: z.string(),
});

function bearerMatches(header: string | null, expected: string): boolean {
  if (!header?.startsWith("Bearer ")) {
    return false;
  }
  return header.slice("Bearer ".length) === expected;
}

/**
 * Receives optional callbacks from the standalone `digital-self` orchestrator
 * when a reply is queued for human approval. Set the same secret in Virgil
 * (`VIRGIL_BRIDGE_WEBHOOK_SECRET`) and on the orchestrator (`VIRGIL_BRIDGE_WEBHOOK_SECRET`).
 */
export async function POST(request: Request) {
  const expected = process.env.VIRGIL_BRIDGE_WEBHOOK_SECRET?.trim();
  if (!expected) {
    return Response.json(
      { error: "VIRGIL_BRIDGE_WEBHOOK_SECRET is not configured" },
      { status: 503 }
    );
  }

  if (!bearerMatches(request.headers.get("authorization"), expected)) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "invalid json" }, { status: 400 });
  }

  const parsed = payloadSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: "invalid body" }, { status: 400 });
  }

  return Response.json({ ok: true, approvalId: parsed.data.approvalId });
}
