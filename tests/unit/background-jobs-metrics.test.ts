import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { computeWallTimeMetrics } from "@/lib/background-jobs/wall-time-metrics";

describe("computeWallTimeMetrics", () => {
  it("returns zeros for empty input", () => {
    assert.deepEqual(computeWallTimeMetrics([]), {
      p50Ms: 0,
      p95Ms: 0,
      p99Ms: 0,
      meanMs: 0,
    });
  });

  it("computes percentiles for sorted-like samples", () => {
    const values = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100];
    const m = computeWallTimeMetrics(values);
    assert.equal(m.p50Ms > 0, true);
    assert.equal(m.meanMs, 55);
  });
});
