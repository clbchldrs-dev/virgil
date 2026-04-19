import { z } from "zod";
import { unauthorizedUnlessDelegationWorker } from "@/lib/api/delegation-worker-auth";
import { completePollWorkerIntent } from "@/lib/db/queries";
import { isDelegationPollPrimaryEnabled } from "@/lib/integrations/delegation-poll-config";
import type { ClawResult } from "@/lib/integrations/openclaw-types";

export const maxDuration = 30;

const completeBodySchema = z.object({
  id: z.string().uuid(),
  success: z.boolean(),
  skill: z.string().min(1),
  executedAt: z.string().min(1),
  output: z.string().optional(),
  error: z.string().optional(),
  routedVia: z.enum(["openclaw", "hermes"]).optional(),
  deferredToPollWorker: z.boolean().optional(),
});

/**
 * Hermes/Manos poll worker: complete a claimed intent (`processing` → `completed` / `failed`).
 */
export async function POST(request: Request) {
  const denied = unauthorizedUnlessDelegationWorker(request);
  if (denied) {
    return denied;
  }
  if (!isDelegationPollPrimaryEnabled()) {
    return Response.json(
      { error: "delegation_poll_primary_disabled" },
      { status: 503 }
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "invalid_json" }, { status: 400 });
  }

  const parsed = completeBodySchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: "invalid_body" }, { status: 400 });
  }

  const result: ClawResult = {
    success: parsed.data.success,
    skill: parsed.data.skill,
    executedAt: parsed.data.executedAt,
    output: parsed.data.output,
    error: parsed.data.error,
    routedVia: parsed.data.routedVia,
    deferredToPollWorker: parsed.data.deferredToPollWorker,
  };

  const updated = await completePollWorkerIntent({
    id: parsed.data.id,
    result,
  });

  if (!updated) {
    return Response.json(
      { error: "not_found_or_not_processing", id: parsed.data.id },
      { status: 409 }
    );
  }

  return Response.json({ ok: true, intent: updated });
}
