"use client";

import { useActiveChat } from "@/hooks/use-active-chat";
import { cn } from "@/lib/utils";
import { useModelMetrics } from "./model-metrics-provider";

function formatTokensPerSec(value: number | null): string {
  if (value === null) {
    return "—";
  }
  return `${value.toFixed(1)} tok/s`;
}

function MetricBlock({ label, value }: { label: string; value: string }) {
  return (
    <div className="space-y-0.5">
      <div className="text-muted-foreground">{label}</div>
      <div className="font-mono text-[11px] text-foreground">{value}</div>
    </div>
  );
}

export function ChatMetricsSidePanel() {
  const { currentModelId } = useActiveChat();
  const { lastMetrics } = useModelMetrics();

  const display =
    lastMetrics && lastMetrics.chatModel === currentModelId
      ? lastMetrics
      : null;

  const emptyHint =
    lastMetrics && lastMetrics.chatModel !== currentModelId
      ? "Last timings were for another model—send a message with this model to refresh."
      : "Send a message to capture first-token time and throughput for the selected model.";

  return (
    <aside
      aria-label="Model performance"
      className={cn(
        "hidden shrink-0 flex-col border-border/40 border-l bg-muted/15 md:flex",
        "w-[12.5rem] lg:w-56"
      )}
    >
      <div className="border-border/40 border-b px-3 py-2 font-medium text-[11px] text-muted-foreground uppercase tracking-wide">
        Last generation
      </div>
      <div className="flex flex-1 flex-col gap-3 overflow-y-auto p-3 text-[11px] leading-snug">
        {!display && <p className="text-muted-foreground">{emptyHint}</p>}
        {display && (
          <>
            <MetricBlock
              label="First token"
              value={
                display.firstTokenMs === null
                  ? "—"
                  : `${display.firstTokenMs} ms`
              }
            />
            <MetricBlock label="Total (wall)" value={`${display.totalMs} ms`} />
            <MetricBlock
              label="Stream window"
              value={`${display.streamWindowMs} ms`}
            />
            <div className="space-y-0.5">
              <div className="text-muted-foreground">Output tokens</div>
              <div className="font-mono text-[11px] text-foreground">
                {display.rateSource === "provider" &&
                display.outputTokensReported !== undefined &&
                display.outputTokensReported > 0
                  ? `${display.outputTokensReported} (provider)`
                  : `~${display.estimatedOutputTokens} (est.)`}
              </div>
            </div>
            <MetricBlock
              label="tok/s (wall)"
              value={formatTokensPerSec(display.tokensPerSecWall)}
            />
            <MetricBlock
              label="tok/s (stream)"
              value={formatTokensPerSec(display.tokensPerSecStream)}
            />
          </>
        )}
      </div>
    </aside>
  );
}
