import "dotenv/config";

import { streamText } from "ai";
import {
  type ChatModel,
  getChatModel,
  resolveRuntimeModelId,
} from "../lib/ai/models";
import {
  buildSmokeTimingReport,
  resolveOllamaSmokeModelIds,
} from "../lib/ai/ollama-smoke";
import { getLanguageModel } from "../lib/ai/providers";

const DEFAULT_OLLAMA_URL = "http://127.0.0.1:11434";

function formatOptions(model: ChatModel): string {
  if (!model.ollamaOptions) {
    return "default";
  }

  return Object.entries(model.ollamaOptions)
    .map(([key, value]) => `${key}=${value}`)
    .join(", ");
}

function printHelp(): void {
  console.log("Usage: pnpm ollama:smoke [model-id ...]");
  console.log("");
  console.log("Runs a live local-generation smoke test against Ollama.");
  console.log(
    "If no model ids are passed, every curated local model is tested."
  );
  console.log("");
  console.log("Examples:");
  console.log("  pnpm ollama:smoke");
  console.log("  pnpm ollama:smoke ollama/qwen2.5:3b-turbo");
  console.log("  pnpm ollama:smoke ollama/qwen2.5:3b ollama/qwen2.5:7b-lean");
  console.log("");
  console.log(
    "Metrics: first_token_ms, output_tokens (provider or ~estimated),"
  );
  console.log(
    "output_tokens_per_s_wall, output_tokens_per_s_stream (first token → end)."
  );
}

function formatTokensPerSec(value: number | null): string {
  if (value === null) {
    return "n/a";
  }

  return value.toFixed(1);
}

async function runSmoke(modelId: string): Promise<boolean> {
  const model = getChatModel(modelId);

  if (!model) {
    throw new Error(`Unknown model id: ${modelId}`);
  }

  const startedAt = Date.now();
  let firstTokenAt: number | null = null;
  let fullText = "";

  try {
    const stream = streamText({
      model: getLanguageModel(modelId, model.ollamaOptions),
      prompt:
        "Reply in one short sentence that includes READY and mentions the preset in plain text.",
      abortSignal: AbortSignal.timeout(45_000),
      maxRetries: 0,
    });

    for await (const delta of stream.fullStream) {
      if (delta.type === "text-delta") {
        if (firstTokenAt === null) {
          firstTokenAt = Date.now();
        }
        fullText += delta.text;
      }
    }

    const endedAt = Date.now();
    const usage = await stream.usage;
    const providerOutputTokens = usage.outputTokens;
    const output = fullText.replace(/\s+/g, " ").trim();
    const timing = buildSmokeTimingReport({
      startedAt,
      firstTokenAt,
      endedAt,
      providerOutputTokens,
      outputText: fullText,
    });

    const tokenLine =
      timing.rateSource === "provider"
        ? `  output_tokens: ${timing.providerOutputTokens} (provider)`
        : `  output_tokens_est: ${timing.estimatedOutputTokens} (~chars/3.5; provider unset)`;

    console.log(`PASS ${modelId}`);
    console.log(`  runtime: ${resolveRuntimeModelId(modelId)}`);
    console.log(`  options: ${formatOptions(model)}`);
    console.log(`  first_token_ms: ${timing.firstTokenMs ?? "n/a"}`);
    console.log(`  total_ms: ${timing.totalMs}`);
    console.log(`  stream_window_ms: ${timing.generationPhaseMs}`);
    console.log(tokenLine);
    console.log(
      `  output_tokens_per_s_wall: ${formatTokensPerSec(timing.tokensPerSecWall)}`
    );
    console.log(
      `  output_tokens_per_s_stream: ${formatTokensPerSec(timing.tokensPerSecStream)}`
    );
    console.log(`  output: ${output}`);

    return true;
  } catch (error) {
    const elapsedMs = Date.now() - startedAt;
    const message = error instanceof Error ? error.message : String(error);

    console.log(`FAIL ${modelId}`);
    console.log(`  runtime: ${resolveRuntimeModelId(modelId)}`);
    console.log(`  options: ${formatOptions(model)}`);
    console.log(`  elapsed_ms: ${elapsedMs}`);
    console.log(`  error: ${message}`);

    return false;
  }
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);

  if (args.includes("--help") || args.includes("-h")) {
    printHelp();
    return;
  }

  const modelIds = resolveOllamaSmokeModelIds(args);
  const ollamaBaseUrl = process.env.OLLAMA_BASE_URL ?? DEFAULT_OLLAMA_URL;

  console.log(`Ollama base URL: ${ollamaBaseUrl}`);
  console.log(`Running ${modelIds.length} smoke test(s)...`);

  let passed = 0;

  for (const modelId of modelIds) {
    const ok = await runSmoke(modelId);
    if (ok) {
      passed += 1;
    }
  }

  console.log("");
  console.log(`Summary: ${passed}/${modelIds.length} passed`);

  if (passed !== modelIds.length) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(message);
  process.exitCode = 1;
});
