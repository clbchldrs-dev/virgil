import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { handleFlightDeckGet } from "@/lib/reliability/flight-deck-handler";

describe("handleFlightDeckGet", () => {
  it("returns 401 when not authorized", async () => {
    const response = await handleFlightDeckGet(
      new Request("http://localhost/api/flight-deck"),
      {
        isAuthorized: async () => false,
        getFallbackRollup: async () => {
          await Promise.resolve();
          throw new Error("should_not_run");
        },
        getQueueSnapshot: async () => {
          await Promise.resolve();
          throw new Error("should_not_run");
        },
        now: () => new Date("2026-04-18T12:00:00.000Z"),
      },
      "user-1"
    );

    assert.equal(response.status, 401);
  });

  it("returns sorted cards and degraded confidence on failures", async () => {
    const response = await handleFlightDeckGet(
      new Request("http://localhost/api/flight-deck?debug=1"),
      {
        isAuthorized: async () => true,
        getFallbackRollup: async () => ({
          current: {
            total: 10,
            completed: 4,
            error: 6,
            byPath: {
              gateway: { total: 5, errors: 4 },
              ollama: { total: 5, errors: 2 },
            },
            byErrorCode: { timeout: 6 },
          },
          previous: {
            total: 10,
            completed: 9,
            error: 1,
            byPath: {
              gateway: { total: 5, errors: 1 },
              ollama: { total: 5, errors: 0 },
            },
            byErrorCode: { timeout: 1 },
          },
          latestEventAt: new Date("2026-04-18T11:59:00.000Z"),
        }),
        getQueueSnapshot: async () => ({
          pending: 1,
          running: 0,
          failedRecent: 0,
          latestEventAt: new Date("2026-04-18T11:58:00.000Z"),
        }),
        now: () => new Date("2026-04-18T12:00:00.000Z"),
      },
      "user-1"
    );

    assert.equal(response.status, 200);
    const body = (await response.json()) as {
      ok: boolean;
      summary: { confidence: string; severity: string };
      cards: Array<{ type: string; severity: string; confidence: string }>;
      sourceErrors: string[];
    };

    assert.equal(body.ok, true);
    assert.equal(body.summary.confidence, "degraded");
    assert.equal(body.summary.severity, "critical");
    assert.equal(body.cards[0]?.type, "chat_fallback");
    assert.equal(body.cards[0]?.severity, "critical");
    assert.equal(body.cards[1]?.type, "queue_health");
    assert.equal(body.sourceErrors.length, 0);
  });

  it("degrades gracefully when a source is unavailable", async () => {
    const response = await handleFlightDeckGet(
      new Request("http://localhost/api/flight-deck"),
      {
        isAuthorized: async () => true,
        getFallbackRollup: async () => {
          await Promise.resolve();
          throw new Error("db_down");
        },
        getQueueSnapshot: async () => ({
          pending: 0,
          running: 0,
          failedRecent: 0,
          latestEventAt: null,
        }),
        now: () => new Date("2026-04-18T12:00:00.000Z"),
      },
      "user-1"
    );

    assert.equal(response.status, 200);
    const body = (await response.json()) as {
      summary: { confidence: string };
      cards: Array<{
        type: string;
        confidence: string;
        sourceErrors: string[];
      }>;
      sourceErrors: string[];
    };

    assert.equal(body.summary.confidence, "unknown");
    const fallbackCard = body.cards.find(
      (card) => card.type === "chat_fallback"
    );
    assert.equal(fallbackCard?.confidence, "unknown");
    assert.deepEqual(fallbackCard?.sourceErrors, [
      "chat_fallback_source_unavailable",
    ]);
    assert.deepEqual(body.sourceErrors, ["chat_fallback_source_unavailable"]);
  });
});
