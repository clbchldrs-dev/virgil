import assert from "node:assert/strict";
import test from "node:test";
import {
  isPendingIntentRetryable,
  PENDING_INTENT_RETRY_AFTER_MS,
} from "@/lib/integrations/delegation-idempotency";

test("retry gate requires sent status", () => {
  assert.equal(
    isPendingIntentRetryable({
      status: "pending",
      sentAt: new Date(Date.now() - PENDING_INTENT_RETRY_AFTER_MS - 1000),
      result: null,
    }),
    false
  );
});

test("retry gate requires sentAt timestamp", () => {
  assert.equal(
    isPendingIntentRetryable({
      status: "sent",
      sentAt: null,
      result: null,
    }),
    false
  );
});

test("retry gate rejects rows that already have a result", () => {
  assert.equal(
    isPendingIntentRetryable({
      status: "sent",
      sentAt: new Date(Date.now() - PENDING_INTENT_RETRY_AFTER_MS - 1000),
      result: { success: false },
    }),
    false
  );
});

test("retry gate rejects fresh sent rows within retry window", () => {
  assert.equal(
    isPendingIntentRetryable({
      status: "sent",
      sentAt: new Date(
        Date.now() - Math.floor(PENDING_INTENT_RETRY_AFTER_MS / 2)
      ),
      result: null,
    }),
    false
  );
});

test("retry gate accepts stale sent rows without result", () => {
  assert.equal(
    isPendingIntentRetryable({
      status: "sent",
      sentAt: new Date(Date.now() - PENDING_INTENT_RETRY_AFTER_MS - 1000),
      result: null,
    }),
    true
  );
});
