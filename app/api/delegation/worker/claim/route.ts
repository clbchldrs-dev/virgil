import { unauthorizedUnlessDelegationWorker } from "@/lib/api/delegation-worker-auth";
import { claimNextPendingIntentForPollWorker } from "@/lib/db/queries";
import { isDelegationPollPrimaryEnabled } from "@/lib/integrations/delegation-poll-config";

export const maxDuration = 30;

/**
 * Hermes/Manos poll worker: claim the next `PendingIntent` on the DB bus.
 * Auth: `Authorization: Bearer <VIRGIL_DELEGATION_WORKER_SECRET>` (or `HERMES_SHARED_SECRET`).
 */
export async function GET(request: Request) {
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

  const row = await claimNextPendingIntentForPollWorker();
  if (!row) {
    return new Response(null, { status: 204 });
  }

  return Response.json(row);
}
