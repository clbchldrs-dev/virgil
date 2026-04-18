import { pendingIntentBlocksImmediateSend } from "@/lib/integrations/openclaw-queue-gate";

export type PendingIntentSkipReason = "awaiting_confirmation" | "wrong_status";

export const PENDING_INTENT_RETRY_AFTER_MS = 5 * 60 * 1000;

export function getPendingIntentSkipReason(row: {
  requiresConfirmation: boolean;
  status: string;
}): PendingIntentSkipReason | null {
  if (pendingIntentBlocksImmediateSend(row)) {
    return "awaiting_confirmation";
  }

  if (row.status !== "pending" && row.status !== "confirmed") {
    return "wrong_status";
  }

  return null;
}

export function isPendingIntentRetryable(row: {
  status: string;
  sentAt: Date | null;
  result: Record<string, unknown> | null;
}): boolean {
  if (row.status !== "sent") {
    return false;
  }

  if (!row.sentAt) {
    return false;
  }

  if (row.result) {
    return false;
  }

  return Date.now() - row.sentAt.getTime() >= PENDING_INTENT_RETRY_AFTER_MS;
}
