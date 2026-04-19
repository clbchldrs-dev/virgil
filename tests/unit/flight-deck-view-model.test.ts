import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  initialFlightDeckActionState,
  reduceFlightDeckActionState,
} from "@/lib/reliability/flight-deck-view-model";

describe("flight deck action view model", () => {
  it("handles confirm -> submit -> success transition", () => {
    const confirming = reduceFlightDeckActionState(
      initialFlightDeckActionState,
      {
        type: "request_confirm",
      }
    );
    assert.equal(confirming.status, "confirming");

    const submitting = reduceFlightDeckActionState(confirming, {
      type: "submit",
    });
    assert.equal(submitting.status, "submitting");

    const success = reduceFlightDeckActionState(submitting, {
      type: "succeeded",
      message: "Digest run queued.",
      requestId: "req-123",
    });
    assert.equal(success.status, "success");
    assert.equal(success.requestId, "req-123");
  });

  it("handles cancel and reset transitions", () => {
    const confirming = reduceFlightDeckActionState(
      initialFlightDeckActionState,
      {
        type: "request_confirm",
      }
    );
    const cancelled = reduceFlightDeckActionState(confirming, {
      type: "cancel_confirm",
    });
    assert.equal(cancelled.status, "idle");

    const failed = reduceFlightDeckActionState(cancelled, {
      type: "failed",
      message: "Action unavailable",
    });
    assert.equal(failed.status, "failed");
    assert.equal(failed.message, "Action unavailable");

    const reset = reduceFlightDeckActionState(failed, { type: "reset" });
    assert.deepEqual(reset, initialFlightDeckActionState);
  });
});
