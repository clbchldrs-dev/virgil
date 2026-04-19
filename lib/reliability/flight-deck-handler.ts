import { commandCenterDeepLink } from "@/lib/command-center/sections";
import type {
  BackgroundQueueSnapshot,
  ChatPathTelemetryRollup,
} from "@/lib/db/queries";
import {
  buildFallbackSignal,
  type SignalConfidence,
} from "@/lib/reliability/flight-deck-signals";

type FlightDeckSeverity = "critical" | "high" | "medium" | "low";
type FlightDeckCardType = "chat_fallback" | "queue_health";

type FlightDeckCard = {
  type: FlightDeckCardType;
  title: string;
  confidence: SignalConfidence;
  severity: FlightDeckSeverity;
  latestEventAt: string | null;
  stale: boolean;
  deepLink: string;
  details: Record<string, unknown>;
  sourceErrors: string[];
};

export type FlightDeckDeps = {
  isAuthorized: () => Promise<boolean>;
  getFallbackRollup: (input: {
    userId: string;
    currentWindowStart: Date;
    previousWindowStart: Date;
  }) => Promise<ChatPathTelemetryRollup>;
  getQueueSnapshot: (input: {
    userId: string;
    since: Date;
  }) => Promise<BackgroundQueueSnapshot>;
  now: () => Date;
};

function severityRank(value: FlightDeckSeverity): number {
  switch (value) {
    case "critical":
      return 0;
    case "high":
      return 1;
    case "medium":
      return 2;
    default:
      return 3;
  }
}

function confidenceRank(value: SignalConfidence): number {
  switch (value) {
    case "healthy":
      return 0;
    case "degraded":
      return 1;
    default:
      return 2;
  }
}

function getQueueSeverity(
  snapshot: BackgroundQueueSnapshot
): FlightDeckSeverity {
  if (snapshot.failedRecent >= 5) {
    return "critical";
  }
  if (snapshot.failedRecent >= 3 || snapshot.running >= 10) {
    return "high";
  }
  if (snapshot.failedRecent >= 1 || snapshot.pending >= 10) {
    return "medium";
  }
  return "low";
}

function getQueueConfidence({
  snapshot,
  now,
  staleAfterMs,
}: {
  snapshot: BackgroundQueueSnapshot;
  now: Date;
  staleAfterMs: number;
}): { confidence: SignalConfidence; stale: boolean } {
  const latestEventAt = snapshot.latestEventAt;
  const stale =
    latestEventAt === null ||
    now.getTime() - latestEventAt.getTime() > staleAfterMs;
  if (stale) {
    return { confidence: "unknown", stale: true };
  }
  if (snapshot.failedRecent > 0 || snapshot.running > 0) {
    return { confidence: "degraded", stale: false };
  }
  return { confidence: "healthy", stale: false };
}

function sortCards(cards: FlightDeckCard[]): FlightDeckCard[] {
  return [...cards].sort((a, b) => {
    const severityDelta = severityRank(a.severity) - severityRank(b.severity);
    if (severityDelta !== 0) {
      return severityDelta;
    }

    const aTime = a.latestEventAt ? Date.parse(a.latestEventAt) : 0;
    const bTime = b.latestEventAt ? Date.parse(b.latestEventAt) : 0;
    if (aTime !== bTime) {
      return bTime - aTime;
    }

    const confidenceDelta =
      confidenceRank(a.confidence) - confidenceRank(b.confidence);
    if (confidenceDelta !== 0) {
      return confidenceDelta;
    }

    return a.type.localeCompare(b.type);
  });
}

export async function handleFlightDeckGet(
  request: Request,
  deps: FlightDeckDeps,
  userId: string
): Promise<Response> {
  if (!(await deps.isAuthorized())) {
    return Response.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const now = deps.now();
  const currentWindowStart = new Date(now.getTime() - 15 * 60 * 1000);
  const previousWindowStart = new Date(now.getTime() - 75 * 60 * 1000);
  const queueWindowStart = new Date(now.getTime() - 15 * 60 * 1000);

  const sourceErrors: string[] = [];
  let fallbackRollup: ChatPathTelemetryRollup | null = null;
  let queueSnapshot: BackgroundQueueSnapshot | null = null;

  try {
    fallbackRollup = await deps.getFallbackRollup({
      userId,
      currentWindowStart,
      previousWindowStart,
    });
  } catch {
    sourceErrors.push("chat_fallback_source_unavailable");
  }

  try {
    queueSnapshot = await deps.getQueueSnapshot({
      userId,
      since: queueWindowStart,
    });
  } catch {
    sourceErrors.push("queue_source_unavailable");
  }

  const cards: FlightDeckCard[] = [];

  if (fallbackRollup) {
    const fallbackSignal = buildFallbackSignal({
      rollup: fallbackRollup,
      now,
      staleAfterMs: 5 * 60 * 1000,
    });
    cards.push({
      type: "chat_fallback",
      title: "Chat fallback and errors",
      confidence: fallbackSignal.confidence,
      severity: fallbackSignal.severity,
      latestEventAt: fallbackSignal.latestEventAt?.toISOString() ?? null,
      stale: fallbackSignal.isStale,
      deepLink: commandCenterDeepLink("background"),
      details: {
        trend: fallbackSignal.trend,
        currentErrorCount: fallbackSignal.currentErrorCount,
        previousErrorCount: fallbackSignal.previousErrorCount,
        fallbackErrorRate: fallbackSignal.fallbackErrorRate,
        pathSummary: fallbackSignal.pathSummary,
      },
      sourceErrors: [],
    });
  } else {
    cards.push({
      type: "chat_fallback",
      title: "Chat fallback and errors",
      confidence: "unknown",
      severity: "high",
      latestEventAt: null,
      stale: true,
      deepLink: commandCenterDeepLink("background"),
      details: {},
      sourceErrors: ["chat_fallback_source_unavailable"],
    });
  }

  if (queueSnapshot) {
    const queueStatus = getQueueConfidence({
      snapshot: queueSnapshot,
      now,
      staleAfterMs: 15 * 60 * 1000,
    });
    cards.push({
      type: "queue_health",
      title: "Queue and job health",
      confidence: queueStatus.confidence,
      severity: getQueueSeverity(queueSnapshot),
      latestEventAt: queueSnapshot.latestEventAt?.toISOString() ?? null,
      stale: queueStatus.stale,
      deepLink: commandCenterDeepLink("background"),
      details: {
        pending: queueSnapshot.pending,
        running: queueSnapshot.running,
        failedRecent: queueSnapshot.failedRecent,
      },
      sourceErrors: [],
    });
  } else {
    cards.push({
      type: "queue_health",
      title: "Queue and job health",
      confidence: "unknown",
      severity: "medium",
      latestEventAt: null,
      stale: true,
      deepLink: commandCenterDeepLink("background"),
      details: {},
      sourceErrors: ["queue_source_unavailable"],
    });
  }

  const orderedCards = sortCards(cards);
  const topLevelConfidence = orderedCards.some(
    (card) => card.confidence === "unknown"
  )
    ? "unknown"
    : orderedCards.some((card) => card.confidence === "degraded")
      ? "degraded"
      : "healthy";
  const topLevelSeverity = orderedCards[0]?.severity ?? "low";

  const url = new URL(request.url);
  const includeDebug = url.searchParams.get("debug") === "1";

  return Response.json(
    {
      ok: true,
      summary: {
        confidence: topLevelConfidence,
        severity: topLevelSeverity,
        generatedAt: now.toISOString(),
      },
      cards: orderedCards,
      sourceErrors,
      ...(includeDebug
        ? {
            windows: {
              currentWindowStart: currentWindowStart.toISOString(),
              previousWindowStart: previousWindowStart.toISOString(),
              queueWindowStart: queueWindowStart.toISOString(),
            },
          }
        : {}),
    },
    { status: 200 }
  );
}
