/**
 * When true, `trySendPendingIntentById` skips the OpenClaw call until the owner confirms.
 */
export function pendingIntentBlocksImmediateSend(row: {
  requiresConfirmation: boolean;
  status: string;
}): boolean {
  return row.requiresConfirmation && row.status === "pending";
}
