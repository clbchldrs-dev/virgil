import {
  delegationBackendDisplayName,
  delegationUnreachableMessage,
} from "@/lib/integrations/delegation-labels";
import type { DelegationBackend } from "@/lib/integrations/delegation-provider";
import type { ClawResult } from "@/lib/integrations/openclaw-types";

export type DelegationSkipReason =
  | "backend_offline"
  | "awaiting_confirmation"
  | "wrong_status";

export type DelegationFailure = {
  ok: false;
  error:
    | "delegation_backend_offline"
    | "intent_awaiting_confirmation"
    | "intent_not_sendable"
    | "delegation_execution_failed";
  reason: DelegationSkipReason | "execution_failed";
  message: string;
  retryable: boolean;
  backend?: DelegationBackend;
  queuedBacklog?: number;
  intentId?: string;
  result?: ClawResult;
};

export type DelegationSuccess = {
  ok: true;
  status: "queued" | "sent";
  intentId: string;
  backend: DelegationBackend;
  queued: boolean;
  message?: string;
  output?: string;
  result?: ClawResult;
};

export type DelegationOutcome = DelegationFailure | DelegationSuccess;

export function buildDelegationSkipFailure({
  reason,
  backend,
  queuedBacklog = 0,
}: {
  reason: DelegationSkipReason;
  backend: DelegationBackend;
  queuedBacklog?: number;
}): DelegationFailure {
  if (reason === "backend_offline") {
    return {
      ok: false,
      error: "delegation_backend_offline",
      reason,
      message: delegationUnreachableMessage(backend, queuedBacklog),
      retryable: true,
      backend,
      queuedBacklog,
    };
  }

  if (reason === "awaiting_confirmation") {
    return {
      ok: false,
      error: "intent_awaiting_confirmation",
      reason,
      message:
        "Intent is still awaiting confirmation before it can be sent to the delegation backend.",
      retryable: false,
      backend,
    };
  }

  return {
    ok: false,
    error: "intent_not_sendable",
    reason,
    message: `Intent is not sendable in its current state (${delegationBackendDisplayName(backend)}).`,
    retryable: false,
    backend,
  };
}

export function delegationFailureStatusCode(
  failure: DelegationFailure
): number {
  return failure.error === "delegation_backend_offline" ? 503 : 409;
}

export function buildDelegationQueuedSuccess({
  backend,
  intentId,
  message,
}: {
  backend: DelegationBackend;
  intentId: string;
  message: string;
}): DelegationSuccess {
  return {
    ok: true,
    status: "queued",
    intentId,
    backend,
    queued: true,
    message,
  };
}

export function buildDelegationSendOutcome({
  backend,
  intentId,
  result,
}: {
  backend: DelegationBackend;
  intentId: string;
  result: ClawResult;
}): DelegationOutcome {
  const effectiveBackend = result.routedVia ?? backend;

  if (result.success) {
    return {
      ok: true,
      status: "sent",
      intentId,
      backend: effectiveBackend,
      queued: false,
      output: result.output,
      result,
    };
  }

  return {
    ok: false,
    error: "delegation_execution_failed",
    reason: "execution_failed",
    backend: effectiveBackend,
    intentId,
    retryable: false,
    message:
      result.error ??
      `Delegation backend reported a failure (${delegationBackendDisplayName(effectiveBackend)}).`,
    result,
  };
}
