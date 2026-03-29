import "dotenv/config";

import { DEFAULT_CHAT_MODEL } from "../lib/ai/models";
import { getOllamaBaseUrl } from "../lib/ai/providers";
import { warmupOllamaModel } from "../lib/ai/warmup-ollama";

function printHelp(): void {
  console.log("Usage: pnpm warmup:ollama [model-id]");
  console.log("");
  console.log(
    "POST /api/generate with keep_alive=-1 so the model stays loaded in VRAM/RAM."
  );
  console.log(
    "Requires Ollama reachable at OLLAMA_BASE_URL (default 127.0.0.1:11434)."
  );
  console.log("");
  console.log("Environment:");
  console.log("  OLLAMA_BASE_URL   Override base URL");
  console.log(
    "  WARMUP_MODEL      Default model id if no arg (default: DEFAULT_CHAT_MODEL)"
  );
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);

  if (args.includes("--help") || args.includes("-h")) {
    printHelp();
    return;
  }

  const modelId = args[0] ?? process.env.WARMUP_MODEL ?? DEFAULT_CHAT_MODEL;

  const baseUrl = process.env.OLLAMA_BASE_URL ?? getOllamaBaseUrl();

  console.log(`Warmup: model=${modelId}`);
  console.log(`Ollama: ${baseUrl}`);

  const started = Date.now();
  await warmupOllamaModel({ baseUrl, modelId });
  console.log(`Done in ${Date.now() - started} ms`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
