import { chatModels, getChatModel, isLocalModel } from "./models";
import { estimateTokens } from "./trim-context";

export type SmokeTimingReport = {
  firstTokenMs: number | null;
  totalMs: number;
  generationPhaseMs: number;
  providerOutputTokens: number | undefined;
  estimatedOutputTokens: number;
  tokensForRate: number;
  rateSource: "provider" | "estimated";
  tokensPerSecWall: number | null;
  tokensPerSecStream: number | null;
};

/**
 * Turn wall-clock boundaries and optional provider token counts into comparable
 * throughput numbers for smoke tests (wall vs streaming window).
 */
export function buildSmokeTimingReport(args: {
  startedAt: number;
  firstTokenAt: number | null;
  endedAt: number;
  providerOutputTokens: number | undefined;
  outputText: string;
}): SmokeTimingReport {
  const totalMs = Math.max(0, args.endedAt - args.startedAt);
  const firstTokenMs =
    args.firstTokenAt === null ? null : args.firstTokenAt - args.startedAt;
  const generationPhaseMs =
    args.firstTokenAt === null
      ? totalMs
      : Math.max(0, args.endedAt - args.firstTokenAt);

  const estimatedOutputTokens = estimateTokens(args.outputText);
  const providerCount = args.providerOutputTokens;
  let tokensForRate: number;
  let rateSource: "provider" | "estimated";
  if (providerCount !== undefined && providerCount > 0) {
    tokensForRate = providerCount;
    rateSource = "provider";
  } else {
    tokensForRate = estimatedOutputTokens;
    rateSource = "estimated";
  }

  const wallS = totalMs / 1000;
  const streamS = Math.max(generationPhaseMs / 1000, 1e-9);

  return {
    firstTokenMs,
    totalMs,
    generationPhaseMs,
    providerOutputTokens: args.providerOutputTokens,
    estimatedOutputTokens,
    tokensForRate,
    rateSource,
    tokensPerSecWall:
      tokensForRate > 0 && wallS > 0 ? tokensForRate / wallS : null,
    tokensPerSecStream:
      tokensForRate > 0 && streamS > 0 ? tokensForRate / streamS : null,
  };
}

export function resolveOllamaSmokeModelIds(
  requestedModelIds: string[]
): string[] {
  if (requestedModelIds.length === 0) {
    return chatModels
      .filter((model) => isLocalModel(model.id))
      .map((model) => model.id);
  }

  return requestedModelIds.map((modelId) => {
    const model = getChatModel(modelId);

    if (!model) {
      throw new Error(`Unknown model id: ${modelId}`);
    }

    if (!isLocalModel(model.id)) {
      throw new Error(`Expected a local Ollama model id, received: ${modelId}`);
    }

    return model.id;
  });
}
