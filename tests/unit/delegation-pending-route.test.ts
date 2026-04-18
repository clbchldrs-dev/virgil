import assert from "node:assert/strict";
import test from "node:test";
import {
  buildPendingIntentApproveResponse,
  buildPendingIntentPatchResponse,
} from "@/lib/integrations/delegation-pending-route";

const SENT_RESULT = {
  skipped: false as const,
  result: {
    success: true,
    output: "done",
    skill: "send-whatsapp",
    executedAt: "2026-01-01T00:00:00.000Z",
  },
};

test("pending route response maps backend_offline for OpenClaw", () => {
  const response = buildPendingIntentPatchResponse({
    intentId: "intent-openclaw-offline",
    backend: "openclaw",
    sendResult: {
      skipped: true,
      reason: "backend_offline",
    },
    queuedBacklog: 2,
  });

  assert.equal(response.status, 503);
  assert.equal(response.body.ok, false);
  assert.equal(response.body.error, "delegation_backend_offline");
  assert.equal(response.body.backend, "openclaw");
  assert.equal(response.body.queuedBacklog, 2);
});

test("pending route response maps backend_offline for Hermes", () => {
  const response = buildPendingIntentPatchResponse({
    intentId: "intent-hermes-offline",
    backend: "hermes",
    sendResult: {
      skipped: true,
      reason: "backend_offline",
    },
    queuedBacklog: 4,
  });

  assert.equal(response.status, 503);
  assert.equal(response.body.ok, false);
  assert.equal(response.body.error, "delegation_backend_offline");
  assert.equal(response.body.backend, "hermes");
  assert.equal(response.body.queuedBacklog, 4);
});

test("pending route response returns sent outcome with intent id", () => {
  const response = buildPendingIntentPatchResponse({
    intentId: "intent-sent-1",
    backend: "hermes",
    sendResult: SENT_RESULT,
  });

  assert.equal(response.status, 200);
  assert.equal(response.body.ok, true);
  assert.equal(response.body.status, "sent");
  assert.equal(response.body.intentId, "intent-sent-1");
  assert.equal(response.body.backend, "hermes");
  assert.equal(response.body.queued, false);
});

test("approve response returns 404 when row is neither pending nor confirmed-unsent", async () => {
  const response = await buildPendingIntentApproveResponse({
    intentId: "intent-missing",
    backend: "openclaw",
    confirmPendingIntent: async () => null,
    isAlreadyConfirmedUnsent: async () => false,
    trySendPendingIntentById: () =>
      Promise.reject(new Error("should not execute send")),
    countDelegationBacklogForUser: async () => 0,
  });

  assert.equal(response.status, 404);
  assert.deepEqual(response.body, {
    error: "not_found_or_not_awaiting_approval",
  });
});

test("approve response maps skipped backend_offline for Hermes and OpenClaw", async () => {
  for (const backend of ["hermes", "openclaw"] as const) {
    const response = await buildPendingIntentApproveResponse({
      intentId: `intent-${backend}-offline`,
      backend,
      confirmPendingIntent: async () => ({ id: "row-1" }),
      isAlreadyConfirmedUnsent: async () => true,
      trySendPendingIntentById: async () => ({
        skipped: true,
        reason: "backend_offline",
      }),
      countDelegationBacklogForUser: async () => 3,
    });

    assert.equal(response.status, 503);
    if ("ok" in response.body) {
      assert.equal(response.body.ok, false);
      assert.equal(response.body.error, "delegation_backend_offline");
      assert.equal(response.body.backend, backend);
      assert.equal(response.body.queuedBacklog, 3);
    } else {
      assert.fail("Expected delegation failure payload");
    }
  }
});

test("approve response returns sent outcome for already-confirmed unsent rows", async () => {
  const response = await buildPendingIntentApproveResponse({
    intentId: "intent-confirmed-unsent",
    backend: "hermes",
    confirmPendingIntent: async () => null,
    isAlreadyConfirmedUnsent: async () => true,
    trySendPendingIntentById: async () => SENT_RESULT,
    countDelegationBacklogForUser: async () => 0,
  });

  assert.equal(response.status, 200);
  if ("ok" in response.body) {
    assert.equal(response.body.ok, true);
    assert.equal(response.body.status, "sent");
    assert.equal(response.body.intentId, "intent-confirmed-unsent");
  } else {
    assert.fail("Expected sent delegation payload");
  }
});
