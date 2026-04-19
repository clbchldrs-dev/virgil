import assert from "node:assert/strict";
import test from "node:test";
import { buildFallbackSignal } from "@/lib/reliability/flight-deck-signals";

function createRollup({
  currentTotal,
  currentErrors,
  previousTotal,
  previousErrors,
  latestEventAt,
}: {
  currentTotal: number;
  currentErrors: number;
  previousTotal: number;
  previousErrors: number;
  latestEventAt: Date | null;
}) {
  const currentGatewayErrors = Math.floor(currentErrors / 2);
  const currentOllamaErrors = currentErrors - currentGatewayErrors;
  const currentGatewayTotal = Math.floor(currentTotal / 2);
  const currentOllamaTotal = currentTotal - currentGatewayTotal;
  const currentByErrorCode: Record<string, number> = {};
  const previousByErrorCode: Record<string, number> = {};
  if (currentErrors > 0) {
    currentByErrorCode.timeout = currentErrors;
  }
  if (previousErrors > 0) {
    previousByErrorCode.timeout = previousErrors;
  }

  return {
    current: {
      total: currentTotal,
      completed: Math.max(currentTotal - currentErrors, 0),
      error: currentErrors,
      byPath: {
        gateway: {
          total: currentGatewayTotal,
          errors: Math.min(currentGatewayErrors, currentGatewayTotal),
        },
        ollama: {
          total: currentOllamaTotal,
          errors: Math.min(currentOllamaErrors, currentOllamaTotal),
        },
      },
      byErrorCode: currentByErrorCode,
    },
    previous: {
      total: previousTotal,
      completed: Math.max(previousTotal - previousErrors, 0),
      error: previousErrors,
      byPath: {
        gateway: { total: previousTotal, errors: previousErrors },
        ollama: { total: 0, errors: 0 },
      },
      byErrorCode: previousByErrorCode,
    },
    latestEventAt,
  };
}

test("marks signal unknown when data is stale", () => {
  const now = new Date("2026-04-18T12:00:00.000Z");
  const signal = buildFallbackSignal({
    rollup: createRollup({
      currentTotal: 10,
      currentErrors: 4,
      previousTotal: 10,
      previousErrors: 1,
      latestEventAt: new Date("2026-04-18T11:00:00.000Z"),
    }),
    now,
    staleAfterMs: 5 * 60 * 1000,
  });

  assert.equal(signal.confidence, "unknown");
  assert.equal(signal.trend, "unknown");
  assert.equal(signal.isStale, true);
});

test("marks signal degraded and worsening when error rate jumps", () => {
  const now = new Date("2026-04-18T12:00:00.000Z");
  const signal = buildFallbackSignal({
    rollup: createRollup({
      currentTotal: 12,
      currentErrors: 6,
      previousTotal: 12,
      previousErrors: 1,
      latestEventAt: new Date("2026-04-18T11:59:00.000Z"),
    }),
    now,
    staleAfterMs: 5 * 60 * 1000,
  });

  assert.equal(signal.confidence, "degraded");
  assert.equal(signal.severity, "critical");
  assert.equal(signal.trend, "worsening");
});

test("marks signal healthy and improving when errors drop", () => {
  const now = new Date("2026-04-18T12:00:00.000Z");
  const signal = buildFallbackSignal({
    rollup: createRollup({
      currentTotal: 20,
      currentErrors: 1,
      previousTotal: 20,
      previousErrors: 6,
      latestEventAt: new Date("2026-04-18T11:59:30.000Z"),
    }),
    now,
    staleAfterMs: 5 * 60 * 1000,
  });

  assert.equal(signal.confidence, "healthy");
  assert.equal(signal.severity, "low");
  assert.equal(signal.trend, "improving");
});
