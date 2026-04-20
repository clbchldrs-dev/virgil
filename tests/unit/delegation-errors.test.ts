import assert from "node:assert/strict";
import { test } from "node:test";
import {
  buildDelegationQueuedSuccess,
  buildDelegationSendOutcome,
  buildDelegationSkipFailure,
  delegationFailureStatusCode,
} from "@/lib/integrations/delegation-errors";

test("buildDelegationSkipFailure maps backend_offline to queued retryable failure", () => {
  const failure = buildDelegationSkipFailure({
    reason: "backend_offline",
    backend: "hermes",
    queuedBacklog: 3,
  });

  assert.equal(failure.ok, false);
  assert.equal(failure.error, "delegation_backend_offline");
  assert.equal(failure.reason, "backend_offline");
  assert.equal(failure.backend, "hermes");
  assert.equal(failure.queuedBacklog, 3);
  assert.equal(failure.retryable, true);
  assert.equal(delegationFailureStatusCode(failure), 503);
});

test("buildDelegationSkipFailure maps awaiting_confirmation to non-retryable conflict", () => {
  const failure = buildDelegationSkipFailure({
    reason: "awaiting_confirmation",
    backend: "openclaw",
  });

  assert.equal(failure.error, "intent_awaiting_confirmation");
  assert.equal(failure.reason, "awaiting_confirmation");
  assert.equal(failure.retryable, false);
  assert.equal(delegationFailureStatusCode(failure), 409);
});

test("buildDelegationSkipFailure maps wrong_status to non-sendable conflict", () => {
  const failure = buildDelegationSkipFailure({
    reason: "wrong_status",
    backend: "openclaw",
  });

  assert.equal(failure.error, "intent_not_sendable");
  assert.equal(failure.reason, "wrong_status");
  assert.equal(failure.retryable, false);
  assert.equal(delegationFailureStatusCode(failure), 409);
});

test("buildDelegationQueuedSuccess returns normalized queued payload", () => {
  const success = buildDelegationQueuedSuccess({
    backend: "hermes",
    intentId: "intent-1",
    message: "Awaiting owner confirmation.",
  });

  assert.equal(success.ok, true);
  assert.equal(success.status, "queued");
  assert.equal(success.intentId, "intent-1");
  assert.equal(success.backend, "hermes");
  assert.equal(success.queued, true);
  assert.equal(success.message, "Awaiting owner confirmation.");
});

test("buildDelegationSendOutcome returns sent payload on execution success", () => {
  const outcome = buildDelegationSendOutcome({
    backend: "openclaw",
    intentId: "intent-2",
    result: {
      success: true,
      output: "sent",
      skill: "send-whatsapp",
      executedAt: "2026-01-01T00:00:00.000Z",
    },
  });

  assert.equal(outcome.ok, true);
  assert.equal(outcome.status, "sent");
  assert.equal(outcome.intentId, "intent-2");
  assert.equal(outcome.backend, "openclaw");
  assert.equal(outcome.queued, false);
  assert.equal(outcome.output, "sent");
});

test("buildDelegationSendOutcome returns execution failure payload on backend failure", () => {
  const outcome = buildDelegationSendOutcome({
    backend: "openclaw",
    intentId: "intent-3",
    result: {
      success: false,
      error: "permission denied",
      skill: "send-whatsapp",
      executedAt: "2026-01-01T00:00:00.000Z",
    },
  });

  assert.equal(outcome.ok, false);
  assert.equal(outcome.error, "delegation_execution_failed");
  assert.equal(outcome.reason, "execution_failed");
  assert.equal(outcome.intentId, "intent-3");
  assert.equal(outcome.backend, "openclaw");
  assert.equal(outcome.message, "permission denied");
});

test("buildDelegationSendOutcome marks network-style gateway failures retryable", () => {
  const outcome = buildDelegationSendOutcome({
    backend: "hermes",
    intentId: "intent-4",
    result: {
      success: false,
      error: "gateway unreachable",
      errorCode: "primary_unreachable",
      skill: "generic-task",
      executedAt: "2026-01-01T00:00:00.000Z",
    },
  });

  assert.equal(outcome.ok, false);
  assert.equal(outcome.error, "delegation_execution_failed");
  assert.equal(outcome.retryable, true);
  assert.equal(outcome.errorCode, "primary_unreachable");
});
