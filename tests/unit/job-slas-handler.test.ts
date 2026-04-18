import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { handleJobSlasGet } from "@/lib/reliability/job-slas-handler";

describe("handleJobSlasGet", () => {
  it("returns 401 for unauthorized requests", async () => {
    const response = await handleJobSlasGet(
      new Request("http://localhost/api/metrics/job-slas"),
      {
        isAuthorized: async () => false,
        listDistinctKinds: async () => [],
        getMetrics: async () => ({
          p50Ms: 1,
          p95Ms: 2,
          p99Ms: 3,
          meanMs: 2,
          sampleCount: 1,
          successRate: 1,
        }),
        getDeviceProfile: () => "Local",
        nowIso: () => "2026-04-18T00:00:00.000Z",
      }
    );

    assert.equal(response.status, 401);
    assert.deepEqual(await response.json(), {
      ok: false,
      error: "unauthorized",
    });
  });

  it("returns structured metrics for requested kind", async () => {
    const response = await handleJobSlasGet(
      new Request("http://localhost/api/metrics/job-slas?kind=nightly_review"),
      {
        isAuthorized: async () => true,
        listDistinctKinds: async () => ["other_kind"],
        getMetrics: async (kind) => ({
          p50Ms: kind.length,
          p95Ms: kind.length + 1,
          p99Ms: kind.length + 2,
          meanMs: kind.length + 0.5,
          sampleCount: 2,
          successRate: 0.9,
        }),
        getDeviceProfile: () => "Local",
        nowIso: () => "2026-04-18T00:00:00.000Z",
      }
    );

    assert.equal(response.status, 200);
    const body = (await response.json()) as {
      ok: boolean;
      summary: {
        totalKinds: number;
        successfulKinds: number;
        fallbackKinds: number;
      };
      failures: unknown[];
      results: Record<string, { sampleCount: number; deviceProfile: string }>;
    };
    assert.equal(body.ok, true);
    assert.equal(body.summary.totalKinds, 1);
    assert.equal(body.summary.successfulKinds, 1);
    assert.equal(body.summary.fallbackKinds, 0);
    assert.equal(body.failures.length, 0);
    assert.equal(body.results.nightly_review?.sampleCount, 2);
    assert.equal(body.results.nightly_review?.deviceProfile, "Local");
  });

  it("falls back per-kind and reports failures when metrics fetch fails", async () => {
    const response = await handleJobSlasGet(
      new Request("http://localhost/api/metrics/job-slas?kind=failing_kind"),
      {
        isAuthorized: async () => true,
        listDistinctKinds: async () => [],
        getMetrics: () => Promise.reject(new Error("metrics_unavailable")),
        getDeviceProfile: () => "Cloud",
        nowIso: () => "2026-04-18T00:00:00.000Z",
      }
    );

    assert.equal(response.status, 200);
    const body = (await response.json()) as {
      summary: { successfulKinds: number; fallbackKinds: number };
      failures: Array<{ kind: string; message: string }>;
      results: Record<string, { note?: string; deviceProfile: string }>;
    };
    assert.equal(body.summary.successfulKinds, 0);
    assert.equal(body.summary.fallbackKinds, 1);
    assert.equal(body.failures[0]?.kind, "failing_kind");
    assert.equal(body.failures[0]?.message, "metrics_unavailable");
    assert.equal(body.results.failing_kind?.note, "Insufficient data");
    assert.equal(body.results.failing_kind?.deviceProfile, "Cloud");
  });
});
