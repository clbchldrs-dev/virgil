/** Pure wall-clock percentile helpers (no DB; safe for unit tests). */
export function computeWallTimeMetrics(wallTimesMs: number[]): {
  p50Ms: number;
  p95Ms: number;
  p99Ms: number;
  meanMs: number;
} {
  if (wallTimesMs.length === 0) {
    return { p50Ms: 0, p95Ms: 0, p99Ms: 0, meanMs: 0 };
  }
  const sorted = [...wallTimesMs].sort((a, b) => a - b);
  const meanMs = sorted.reduce((acc, v) => acc + v, 0) / sorted.length;
  const p = (pct: number) => {
    if (sorted.length === 1) {
      return sorted[0];
    }
    const idx = (pct / 100) * (sorted.length - 1);
    const lo = Math.floor(idx);
    const hi = Math.ceil(idx);
    if (lo === hi) {
      return sorted[lo];
    }
    return sorted[lo] * (hi - idx) + sorted[hi] * (idx - lo);
  };
  return {
    p50Ms: Math.round(p(50)),
    p95Ms: Math.round(p(95)),
    p99Ms: Math.round(p(99)),
    meanMs: Math.round(meanMs),
  };
}
