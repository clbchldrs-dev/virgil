import type { UIMessageStreamWriter } from "ai";

import type { ChatMessage, ModelMetricsPayload } from "@/lib/types";
import { buildSmokeTimingReport } from "./ollama-smoke";

/**
 * Attach to every `streamText` call so the UI can show latency / throughput
 * for the last completed generation (see `data-model-metrics`).
 */
export function createModelMetricsStreamHooks({
  chatModel,
  dataStream,
}: {
  chatModel: string;
  dataStream: UIMessageStreamWriter<ChatMessage>;
}) {
  const streamStartedAt = Date.now();
  let firstTextTokenAt: number | null = null;

  return {
    onChunk: ({ chunk }: { chunk: { type: string } }) => {
      if (chunk.type === "text-delta" && firstTextTokenAt === null) {
        firstTextTokenAt = Date.now();
      }
    },
    onFinish: ({
      text,
      totalUsage,
    }: {
      text: string;
      totalUsage: { outputTokens?: number | undefined };
    }) => {
      const endedAt = Date.now();
      const report = buildSmokeTimingReport({
        startedAt: streamStartedAt,
        firstTokenAt: firstTextTokenAt,
        endedAt,
        providerOutputTokens: totalUsage.outputTokens,
        outputText: text,
      });

      const payload: ModelMetricsPayload = {
        chatModel,
        firstTokenMs: report.firstTokenMs,
        totalMs: report.totalMs,
        streamWindowMs: report.generationPhaseMs,
        outputTokensReported: report.providerOutputTokens,
        estimatedOutputTokens: report.estimatedOutputTokens,
        rateSource: report.rateSource,
        tokensPerSecWall: report.tokensPerSecWall,
        tokensPerSecStream: report.tokensPerSecStream,
      };

      dataStream.write({ type: "data-model-metrics", data: payload });
    },
  };
}
