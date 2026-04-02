import "server-only";

import { queuePendingIntent, trySendPendingIntentById } from "@/lib/db/queries";
import { buildOpenClawIntentFromVirgilEvent } from "@/lib/integrations/openclaw-actions";
import { pingOpenClaw } from "@/lib/integrations/openclaw-client";
import type { VirgilBridgeEvent } from "@/lib/integrations/openclaw-types";

/**
 * Called when a Virgil event should be delegated to OpenClaw.
 * When Redis Streams exist (pivot Phase 3), processors call this after XREADGROUP.
 */
export async function dispatchVirgilEventToOpenClaw({
  userId,
  chatId,
  event,
}: {
  userId: string;
  chatId?: string;
  event: VirgilBridgeEvent;
}): Promise<{ queuedId: string | null }> {
  const intent = buildOpenClawIntentFromVirgilEvent(event);
  if (!intent) {
    return { queuedId: null };
  }

  const row = await queuePendingIntent({
    userId,
    chatId,
    intent,
    skill: intent.skill,
    requiresConfirmation: intent.requiresConfirmation,
  });

  const online = await pingOpenClaw();
  if (online && !intent.requiresConfirmation) {
    await trySendPendingIntentById({ id: row.id, userId });
  }

  return { queuedId: row.id };
}
