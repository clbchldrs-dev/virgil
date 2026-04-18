import {
  buildDelegationSendOutcome,
  buildDelegationSkipFailure,
  type DelegationOutcome,
  delegationFailureStatusCode,
} from "@/lib/integrations/delegation-errors";
import type { DelegationBackend } from "@/lib/integrations/delegation-provider";
import type { ClawResult } from "@/lib/integrations/openclaw-types";

export type PendingIntentSendResult =
  | {
      skipped: true;
      reason: "awaiting_confirmation" | "wrong_status" | "backend_offline";
    }
  | {
      skipped: false;
      result: ClawResult;
    };

export type PendingIntentPatchResponseBody =
  | DelegationOutcome
  | { error: "not_found_or_not_awaiting_approval" };

export function buildPendingIntentPatchResponse({
  intentId,
  backend,
  sendResult,
  queuedBacklog = 0,
}: {
  intentId: string;
  backend: DelegationBackend;
  sendResult: PendingIntentSendResult;
  queuedBacklog?: number;
}): {
  status: number;
  body: DelegationOutcome;
} {
  if (sendResult.skipped) {
    const failure = buildDelegationSkipFailure({
      reason: sendResult.reason,
      backend,
      queuedBacklog,
    });
    return {
      status: delegationFailureStatusCode(failure),
      body: failure,
    };
  }

  return {
    status: 200,
    body: buildDelegationSendOutcome({
      backend,
      intentId,
      result: sendResult.result,
    }),
  };
}

export async function buildPendingIntentApproveResponse({
  intentId,
  backend,
  confirmPendingIntent,
  isAlreadyConfirmedUnsent,
  trySendPendingIntentById,
  countDelegationBacklogForUser,
}: {
  intentId: string;
  backend: DelegationBackend;
  confirmPendingIntent: () => Promise<unknown | null>;
  isAlreadyConfirmedUnsent: () => Promise<boolean>;
  trySendPendingIntentById: () => Promise<PendingIntentSendResult>;
  countDelegationBacklogForUser: () => Promise<number>;
}): Promise<{
  status: number;
  body: PendingIntentPatchResponseBody;
}> {
  const confirmed = await confirmPendingIntent();
  if (!confirmed) {
    const alreadyConfirmed = await isAlreadyConfirmedUnsent();
    if (!alreadyConfirmed) {
      return {
        status: 404,
        body: { error: "not_found_or_not_awaiting_approval" },
      };
    }
  }

  const sendResult = await trySendPendingIntentById();
  if (sendResult.skipped && sendResult.reason === "backend_offline") {
    const queuedBacklog = await countDelegationBacklogForUser();
    return buildPendingIntentPatchResponse({
      intentId,
      backend,
      sendResult,
      queuedBacklog,
    });
  }

  return buildPendingIntentPatchResponse({
    intentId,
    backend,
    sendResult,
  });
}
