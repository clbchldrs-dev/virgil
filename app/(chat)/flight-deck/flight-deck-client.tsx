"use client";

import { formatDistanceToNow } from "date-fns";
import Link from "next/link";
import { useMemo, useReducer } from "react";
import useSWR from "swr";
import { toast } from "@/components/chat/toast";
import { Button } from "@/components/ui/button";
import {
  initialFlightDeckActionState,
  reduceFlightDeckActionState,
} from "@/lib/reliability/flight-deck-view-model";

type CardConfidence = "healthy" | "degraded" | "unknown";
type CardSeverity = "critical" | "high" | "medium" | "low";

type FlightDeckCard = {
  type: "chat_fallback" | "queue_health";
  title: string;
  confidence: CardConfidence;
  severity: CardSeverity;
  latestEventAt: string | null;
  stale: boolean;
  deepLink: string;
  details: Record<string, unknown>;
  sourceErrors: string[];
};

type FlightDeckResponse = {
  ok: boolean;
  summary: {
    confidence: CardConfidence;
    severity: CardSeverity;
    generatedAt: string;
  };
  cards: FlightDeckCard[];
  sourceErrors: string[];
};

function fetchFlightDeck(url: string): Promise<FlightDeckResponse> {
  return fetch(url).then(async (res) => {
    const body = (await res.json().catch(() => ({}))) as FlightDeckResponse & {
      error?: string;
    };
    if (!res.ok) {
      throw new Error(body.error ?? "Failed to load flight deck");
    }
    return body;
  });
}

function severityStyles(severity: CardSeverity): string {
  switch (severity) {
    case "critical":
      return "bg-destructive/15 text-destructive";
    case "high":
      return "bg-amber-500/15 text-amber-800 dark:text-amber-400";
    case "medium":
      return "bg-blue-500/15 text-blue-700 dark:text-blue-300";
    default:
      return "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400";
  }
}

function confidenceLabel(confidence: CardConfidence): string {
  if (confidence === "healthy") {
    return "Healthy";
  }
  if (confidence === "degraded") {
    return "Degraded";
  }
  return "Unknown";
}

async function executeDigestAction(): Promise<{
  ok: boolean;
  message: string;
  requestId: string | null;
}> {
  const requestId = crypto.randomUUID();
  const actionToken = crypto.randomUUID();
  const res = await fetch("/api/flight-deck/actions/digest", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-idempotency-key": requestId,
      "x-flightdeck-action-token": actionToken,
    },
  });
  const body = (await res.json().catch(() => ({}))) as {
    ok?: boolean;
    message?: string;
    requestId?: string | null;
    error?: string;
  };

  if (!res.ok) {
    if (res.status === 404) {
      return {
        ok: false,
        message: "Digest action endpoint is not available yet.",
        requestId: null,
      };
    }
    return {
      ok: false,
      message: body.error ?? body.message ?? "Digest action failed.",
      requestId: null,
    };
  }

  return {
    ok: Boolean(body.ok),
    message: body.message ?? "Digest run queued.",
    requestId: body.requestId ?? requestId,
  };
}

export function FlightDeckClient({ embedded = false }: { embedded?: boolean }) {
  const [actionState, dispatch] = useReducer(
    reduceFlightDeckActionState,
    initialFlightDeckActionState
  );

  const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
  const url = `${basePath}/api/flight-deck`;
  const { data, error, isLoading, mutate, isValidating } = useSWR(
    url,
    fetchFlightDeck,
    {
      revalidateOnFocus: true,
    }
  );

  const chatCard = useMemo(
    () => data?.cards.find((card) => card.type === "chat_fallback") ?? null,
    [data]
  );

  const handleConfirmDigestRun = async () => {
    dispatch({ type: "submit" });
    const result = await executeDigestAction();
    if (result.ok) {
      dispatch({
        type: "succeeded",
        message: result.message,
        requestId: result.requestId,
      });
      toast({ type: "success", description: result.message });
      await mutate();
      return;
    }

    dispatch({ type: "failed", message: result.message });
    toast({ type: "error", description: result.message });
  };

  const titleClass = embedded
    ? "text-xl font-semibold tracking-tight"
    : "text-2xl font-semibold tracking-tight";

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        {embedded ? (
          <h2 className={titleClass}>Operator flight deck</h2>
        ) : (
          <h1 className={titleClass}>Operator flight deck</h1>
        )}
        <p className="text-muted-foreground">
          Triage-first summary for fallback risk and queue health. Use this
          surface to decide the first recovery move, then open the Background
          section for queue and job detail.
        </p>
      </div>

      <section className="rounded-xl border border-border/60 bg-card/30 p-6 shadow-[var(--shadow-float)]">
        {isLoading ? (
          <p className="text-muted-foreground text-sm">
            Loading current signal state…
          </p>
        ) : error ? (
          <div className="space-y-3">
            <p className="text-destructive text-sm">
              Could not load flight deck signals.
            </p>
            <Button
              onClick={() => {
                mutate();
              }}
              size="sm"
              variant="outline"
            >
              Retry
            </Button>
          </div>
        ) : data ? (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <span
                className={`rounded-full px-2 py-0.5 text-xs font-medium ${severityStyles(data.summary.severity)}`}
              >
                {data.summary.severity.toUpperCase()}
              </span>
              <span className="rounded-md bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                {confidenceLabel(data.summary.confidence)}
              </span>
              <span className="text-muted-foreground text-xs">
                Updated{" "}
                {formatDistanceToNow(new Date(data.summary.generatedAt), {
                  addSuffix: true,
                })}
              </span>
              {isValidating ? (
                <span className="text-muted-foreground text-xs">
                  Refreshing…
                </span>
              ) : null}
            </div>

            <ul className="space-y-3">
              {data.cards.map((card) => (
                <li
                  className="rounded-lg border border-border/50 bg-background/40 p-4"
                  key={card.type}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="font-medium text-sm">{card.title}</p>
                    <div className="flex items-center gap-2">
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-medium ${severityStyles(card.severity)}`}
                      >
                        {card.severity}
                      </span>
                      <span className="rounded-md bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                        {confidenceLabel(card.confidence)}
                      </span>
                      <Link
                        className="text-primary text-xs hover:underline"
                        href={card.deepLink}
                      >
                        Open details
                      </Link>
                    </div>
                  </div>
                  <p className="mt-2 text-muted-foreground text-xs">
                    {card.latestEventAt
                      ? `Last signal ${formatDistanceToNow(new Date(card.latestEventAt), { addSuffix: true })}`
                      : "No recent signal events"}
                    {card.stale ? " · stale" : ""}
                  </p>
                  {card.sourceErrors.length > 0 ? (
                    <p className="mt-2 text-destructive text-xs">
                      Source warnings: {card.sourceErrors.join(", ")}
                    </p>
                  ) : null}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </section>

      <section className="rounded-xl border border-border/60 bg-card/30 p-6 shadow-[var(--shadow-float)]">
        <h2 className="text-lg font-medium">Digest action</h2>
        <p className="mt-1 text-muted-foreground text-sm">
          Safe one-click action flow for manual digest run: confirm, execute,
          then review outcome.
        </p>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <Button
            disabled={actionState.status === "submitting"}
            onClick={() => {
              dispatch({ type: "request_confirm" });
            }}
            size="sm"
            type="button"
            variant="secondary"
          >
            {actionState.status === "submitting"
              ? "Submitting…"
              : "Run digest now"}
          </Button>
          {actionState.status === "confirming" ? (
            <>
              <Button onClick={handleConfirmDigestRun} size="sm" type="button">
                Confirm run
              </Button>
              <Button
                onClick={() => {
                  dispatch({ type: "cancel_confirm" });
                }}
                size="sm"
                type="button"
                variant="outline"
              >
                Cancel
              </Button>
            </>
          ) : null}
          {(actionState.status === "success" ||
            actionState.status === "failed") &&
          actionState.message ? (
            <p
              className={`text-sm ${actionState.status === "success" ? "text-emerald-700 dark:text-emerald-400" : "text-destructive"}`}
            >
              {actionState.message}
              {actionState.requestId
                ? ` (request ${actionState.requestId})`
                : ""}
            </p>
          ) : null}
        </div>
      </section>

      {chatCard ? (
        <section className="rounded-xl border border-border/60 bg-card/30 p-6 shadow-[var(--shadow-float)]">
          <h2 className="text-lg font-medium">Fallback snapshot</h2>
          <p className="mt-2 text-muted-foreground text-sm">
            Current error count:{" "}
            {String(chatCard.details.currentErrorCount ?? 0)} · Previous window:{" "}
            {String(chatCard.details.previousErrorCount ?? 0)}
          </p>
        </section>
      ) : null}
    </div>
  );
}
