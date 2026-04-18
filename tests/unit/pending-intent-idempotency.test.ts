import assert from "node:assert/strict";
import test from "node:test";
import {
  getPendingIntentSkipReason,
  type PendingIntentSkipReason,
} from "@/lib/integrations/delegation-idempotency";

function skipReasonValues(
  input: { requiresConfirmation: boolean; status: string },
  expected: PendingIntentSkipReason | null
): {
  actual: PendingIntentSkipReason | null;
  expected: PendingIntentSkipReason | null;
} {
  return {
    actual: getPendingIntentSkipReason(input),
    expected,
  };
}

test("idempotency gate blocks pending confirmation rows", () => {
  const { actual, expected } = skipReasonValues(
    {
      requiresConfirmation: true,
      status: "pending",
    },
    "awaiting_confirmation"
  );
  assert.equal(actual, expected);
});

test("idempotency gate allows confirmed rows through to send path", () => {
  const { actual, expected } = skipReasonValues(
    {
      requiresConfirmation: true,
      status: "confirmed",
    },
    null
  );
  assert.equal(actual, expected);
});

test("idempotency gate treats sent/completed/failed/rejected as non-sendable", () => {
  for (const status of ["sent", "completed", "failed", "rejected"] as const) {
    const { actual, expected } = skipReasonValues(
      {
        requiresConfirmation: false,
        status,
      },
      "wrong_status"
    );
    assert.equal(actual, expected);
  }
});

test("idempotency gate allows non-confirmation pending rows", () => {
  const { actual, expected } = skipReasonValues(
    {
      requiresConfirmation: false,
      status: "pending",
    },
    null
  );
  assert.equal(actual, expected);
});
