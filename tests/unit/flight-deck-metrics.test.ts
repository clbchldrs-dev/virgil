import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  FLIGHT_DECK_MEASUREMENT_FIELDS,
  getRunbookTargetForFlightDeckCard,
} from "@/lib/reliability/flight-deck-metrics";

describe("flight-deck-metrics", () => {
  it("maps chat_fallback to the chat fallback runbook target", () => {
    const target = getRunbookTargetForFlightDeckCard({
      type: "chat_fallback",
      confidence: "degraded",
    });
    assert.equal(target.id, "flight-deck-chat-fallback-card");
    assert.match(target.hint, /telemetry/i);
    assert.match(target.docRelativePath, /operator-integrations-runbook/);
  });

  it("maps queue_health to the queue health runbook target", () => {
    const target = getRunbookTargetForFlightDeckCard({
      type: "queue_health",
      confidence: "healthy",
    });
    assert.equal(target.id, "flight-deck-queue-health-card");
    assert.match(target.hint, /background job/i);
  });

  it("falls back to generic guidance for unknown card types", () => {
    const target = getRunbookTargetForFlightDeckCard({
      type: "unknown_future_card",
    });
    assert.equal(target.id, "operator-flight-deck");
    assert.match(target.sectionTitle, /Operator flight deck/);
  });

  it("extends hint when confidence is unknown", () => {
    const target = getRunbookTargetForFlightDeckCard({
      type: "chat_fallback",
      confidence: "unknown",
    });
    assert.match(target.hint, /unknown/);
    assert.match(target.hint, /Postgres/i);
  });

  it("lists measurement fields for triage logging", () => {
    assert.ok(
      FLIGHT_DECK_MEASUREMENT_FIELDS.includes("stable_state_observed_at")
    );
    assert.ok(
      FLIGHT_DECK_MEASUREMENT_FIELDS.includes("digest_manual_run_request_id")
    );
  });
});
