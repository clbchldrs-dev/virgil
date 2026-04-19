import type { ChatPathTelemetryRollup } from "@/lib/db/queries";

export type SignalConfidence = "healthy" | "degraded" | "unknown";
export type SignalSeverity = "critical" | "high" | "medium" | "low";
export type SignalTrend = "worsening" | "improving" | "steady" | "unknown";

export type FallbackSignal = {
  confidence: SignalConfidence;
  severity: SignalSeverity;
  trend: SignalTrend;
  fallbackErrorRate: number;
  currentErrorCount: number;
  previousErrorCount: number;
  latestEventAt: Date | null;
  isStale: boolean;
  pathSummary: ChatPathTelemetryRollup["current"]["byPath"];
};

function toRate(errors: number, total: number): number {
  if (total <= 0) {
    return 0;
  }
  return errors / total;
}

function classifySeverity(
  errorRate: number,
  errorCount: number
): SignalSeverity {
  if (errorCount >= 8 || errorRate >= 0.5) {
    return "critical";
  }
  if (errorCount >= 4 || errorRate >= 0.25) {
    return "high";
  }
  if (errorCount >= 2 || errorRate >= 0.1) {
    return "medium";
  }
  return "low";
}

function classifyTrend(currentRate: number, previousRate: number): SignalTrend {
  if (previousRate === 0 && currentRate === 0) {
    return "steady";
  }
  if (previousRate === 0 && currentRate > 0) {
    return "worsening";
  }

  const delta = currentRate - previousRate;
  if (Math.abs(delta) < 0.03) {
    return "steady";
  }
  return delta > 0 ? "worsening" : "improving";
}

export function buildFallbackSignal({
  rollup,
  now,
  staleAfterMs,
}: {
  rollup: ChatPathTelemetryRollup;
  now: Date;
  staleAfterMs: number;
}): FallbackSignal {
  const current = rollup.current;
  const previous = rollup.previous;
  const fallbackErrors =
    current.byPath.gateway.errors + current.byPath.ollama.errors;
  const fallbackErrorRate = toRate(fallbackErrors, current.total);
  const previousRate = toRate(previous.error, previous.total);
  const trend = classifyTrend(fallbackErrorRate, previousRate);
  const severity = classifySeverity(fallbackErrorRate, fallbackErrors);
  const latestEventAt = rollup.latestEventAt;
  const isStale =
    latestEventAt === null ||
    now.getTime() - latestEventAt.getTime() > staleAfterMs;

  let confidence: SignalConfidence = "healthy";
  if (current.total === 0 || isStale) {
    confidence = "unknown";
  } else if (severity === "high" || severity === "critical") {
    confidence = "degraded";
  }

  return {
    confidence,
    severity,
    trend: confidence === "unknown" ? "unknown" : trend,
    fallbackErrorRate,
    currentErrorCount: fallbackErrors,
    previousErrorCount: previous.error,
    latestEventAt,
    isStale,
    pathSummary: current.byPath,
  };
}
