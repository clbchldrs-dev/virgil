import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { handleNightReviewEnqueueGet } from "@/lib/reliability/night-review-enqueue-handler";

describe("handleNightReviewEnqueueGet", () => {
  it("returns 401 for invalid cron auth", async () => {
    const response = await handleNightReviewEnqueueGet(
      new Request("http://localhost/api/night-review/enqueue"),
      {
        cronSecret: "secret",
        isEnabled: () => true,
        shouldEnqueueNow: () => true,
        getTimezone: () => "UTC",
        getOffPeakBounds: () => ({ startHour: 23, endHourExclusive: 7 }),
        getRunLocalHour: () => 3,
        getModelId: () => "ollama/qwen2.5:7b-review",
        resolveModel: () => ({ ok: true }),
        isQstashConfigured: () => true,
        getOwners: async () => [],
        computeWindow: () => ({
          windowStart: new Date("2026-04-18T00:00:00.000Z"),
          windowEnd: new Date("2026-04-19T00:00:00.000Z"),
        }),
        computeWindowKey: () => "2026-04-19",
        generateRunId: () => "run-id",
        getBaseUrl: () => "http://localhost:3000",
        getStaggerSeconds: () => 60,
        publish: () => Promise.resolve(undefined),
        now: () => new Date("2026-04-19T03:00:00.000Z"),
      }
    );

    assert.equal(response.status, 401);
  });

  it("returns skipped when outside configured enqueue slot", async () => {
    const response = await handleNightReviewEnqueueGet(
      new Request("http://localhost/api/night-review/enqueue", {
        headers: { authorization: "Bearer secret" },
      }),
      {
        cronSecret: "secret",
        isEnabled: () => true,
        shouldEnqueueNow: () => false,
        getTimezone: () => "America/New_York",
        getOffPeakBounds: () => ({ startHour: 23, endHourExclusive: 7 }),
        getRunLocalHour: () => 3,
        getModelId: () => "ollama/qwen2.5:7b-review",
        resolveModel: () => ({ ok: true }),
        isQstashConfigured: () => true,
        getOwners: async () => [],
        computeWindow: () => ({
          windowStart: new Date("2026-04-18T00:00:00.000Z"),
          windowEnd: new Date("2026-04-19T00:00:00.000Z"),
        }),
        computeWindowKey: () => "2026-04-19",
        generateRunId: () => "run-id",
        getBaseUrl: () => "http://localhost:3000",
        getStaggerSeconds: () => 60,
        publish: () => Promise.resolve(undefined),
        now: () => new Date("2026-04-19T10:00:00.000Z"),
      }
    );

    assert.equal(response.status, 200);
    const body = (await response.json()) as {
      skipped: boolean;
      reason: string;
    };
    assert.equal(body.skipped, true);
    assert.equal(body.reason, "outside_off_peak_slot");
  });

  it("reports enqueue summary and publish failures", async () => {
    const published: Array<{ userId: string; delay: number }> = [];
    const response = await handleNightReviewEnqueueGet(
      new Request("http://localhost/api/night-review/enqueue", {
        headers: { authorization: "Bearer secret" },
      }),
      {
        cronSecret: "secret",
        isEnabled: () => true,
        shouldEnqueueNow: () => true,
        getTimezone: () => "UTC",
        getOffPeakBounds: () => ({ startHour: 23, endHourExclusive: 7 }),
        getRunLocalHour: () => 3,
        getModelId: () => "ollama/qwen2.5:7b-review",
        resolveModel: () => ({ ok: true }),
        isQstashConfigured: () => true,
        getOwners: async () => [
          { id: "guest-user", email: "guest-1" },
          { id: "ok-user", email: "owner1@example.com" },
          { id: "fail-user", email: "owner2@example.com" },
        ],
        computeWindow: () => ({
          windowStart: new Date("2026-04-18T00:00:00.000Z"),
          windowEnd: new Date("2026-04-19T00:00:00.000Z"),
        }),
        computeWindowKey: () => "2026-04-19",
        generateRunId: () => "run-id",
        getBaseUrl: () => "http://localhost:3000",
        getStaggerSeconds: () => 60,
        publish: ({ body, delay }) => {
          if (body.userId === "fail-user") {
            return Promise.reject(new Error("publish_failed"));
          }
          published.push({ userId: body.userId, delay });
          return Promise.resolve();
        },
        now: () => new Date("2026-04-19T03:00:00.000Z"),
      }
    );

    assert.equal(response.status, 200);
    const body = (await response.json()) as {
      summary: {
        ownersScanned: number;
        guestOwnersSkipped: number;
        eligibleOwners: number;
        enqueued: number;
        publishFailures: number;
      };
      failures: Array<{ ownerId: string; message: string }>;
    };
    assert.equal(body.summary.ownersScanned, 3);
    assert.equal(body.summary.guestOwnersSkipped, 1);
    assert.equal(body.summary.eligibleOwners, 2);
    assert.equal(body.summary.enqueued, 1);
    assert.equal(body.summary.publishFailures, 1);
    assert.equal(body.failures[0]?.ownerId, "fail-user");
    assert.equal(published.length, 1);
    assert.equal(published[0]?.delay, 0);
  });
});
