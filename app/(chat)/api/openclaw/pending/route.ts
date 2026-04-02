import { z } from "zod";
import { auth } from "@/app/(auth)/auth";
import {
  confirmPendingIntent,
  countOpenClawBacklogForUser,
  getPendingConfirmationsForUser,
  rejectPendingIntent,
  trySendPendingIntentById,
} from "@/lib/db/queries";
import { pingOpenClaw } from "@/lib/integrations/openclaw-client";
import { isOpenClawConfigured } from "@/lib/integrations/openclaw-config";

const patchBodySchema = z.object({
  id: z.string().uuid(),
  action: z.enum(["approve", "reject"]),
  reason: z.string().max(500).optional(),
});

export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  const configured = isOpenClawConfigured();
  const pendingConfirmations = await getPendingConfirmationsForUser(
    session.user.id
  );
  const online = configured ? await pingOpenClaw() : false;
  const queuedBacklog = await countOpenClawBacklogForUser(session.user.id);

  return Response.json({
    configured,
    openClawOnline: online,
    pendingConfirmations,
    queuedBacklog,
    offlineMessage:
      !online && queuedBacklog > 0
        ? `OpenClaw is offline — ${String(queuedBacklog)} task(s) queued.`
        : null,
  });
}

export async function PATCH(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "invalid json" }, { status: 400 });
  }

  const parsed = patchBodySchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: "invalid body" }, { status: 400 });
  }

  const { id, action, reason } = parsed.data;

  if (action === "reject") {
    const row = await rejectPendingIntent({
      id,
      userId: session.user.id,
      reason,
    });
    if (!row) {
      return Response.json({ error: "not found" }, { status: 404 });
    }
    return Response.json({ ok: true, intent: row });
  }

  const confirmed = await confirmPendingIntent({
    id,
    userId: session.user.id,
  });
  if (!confirmed) {
    return Response.json(
      { error: "not found or not awaiting approval" },
      {
        status: 404,
      }
    );
  }

  const sendResult = await trySendPendingIntentById({
    id,
    userId: session.user.id,
  });

  if (sendResult.skipped) {
    return Response.json(
      { error: "intent could not be sent", detail: sendResult.reason },
      { status: 409 }
    );
  }

  return Response.json({
    ok: sendResult.result.success,
    result: sendResult.result,
  });
}
