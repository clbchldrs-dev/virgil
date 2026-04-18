import { z } from "zod";
import { auth } from "@/app/(auth)/auth";
import {
  confirmPendingIntent,
  countDelegationBacklogForUser,
  getPendingConfirmationsForUser,
  isAlreadyConfirmedUnsent,
  rejectPendingIntent,
  trySendPendingIntentById,
} from "@/lib/db/queries";
import {
  getDelegationProvider,
  isDelegationConfigured,
} from "@/lib/integrations/delegation-provider";

const patchBodySchema = z.object({
  id: z.string().uuid(),
  action: z.enum(["approve", "reject"]),
  reason: z.string().max(500).optional(),
});

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  const userId = session.user.id;
  const delegationProvider = getDelegationProvider();
  const configured = isDelegationConfigured();
  const pendingConfirmations = await getPendingConfirmationsForUser(userId);
  const online = configured ? await delegationProvider.ping() : false;
  const queuedBacklog = await countDelegationBacklogForUser(userId);
  const backendLabel =
    delegationProvider.backend === "hermes" ? "Hermes" : "OpenClaw";

  return Response.json({
    backend: delegationProvider.backend,
    configured,
    delegationOnline: online,
    openClawOnline: online,
    pendingConfirmations,
    queuedBacklog,
    offlineMessage:
      !online && queuedBacklog > 0
        ? `${backendLabel} is offline — ${String(queuedBacklog)} task(s) queued.`
        : null,
  });
}

export async function PATCH(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  const userId = session.user.id;

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
    const row = await rejectPendingIntent({ id, userId, reason });
    if (!row) {
      return Response.json({ error: "not found" }, { status: 404 });
    }
    return Response.json({ ok: true, intent: row });
  }

  const confirmed = await confirmPendingIntent({ id, userId });

  if (!confirmed) {
    const alreadyConfirmed = await isAlreadyConfirmedUnsent({ id, userId });
    if (!alreadyConfirmed) {
      return Response.json(
        { error: "not found or not awaiting approval" },
        { status: 404 }
      );
    }
  }

  try {
    const sendResult = await trySendPendingIntentById({ id, userId });

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
  } catch {
    return Response.json(
      { error: "failed to send intent after approval" },
      { status: 500 }
    );
  }
}
