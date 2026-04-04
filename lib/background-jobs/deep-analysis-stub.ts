import "server-only";

import type { BackgroundJob } from "@/lib/db/schema";

/**
 * Placeholder processor for `deep_analysis` jobs. Swap for an LLM-backed
 * pipeline without changing the queue contract.
 */
export async function runDeepAnalysisStub(
  job: BackgroundJob
): Promise<Record<string, unknown>> {
  await Promise.resolve();
  const input = job.input as { query?: unknown };
  const query = typeof input.query === "string" ? input.query.trim() : "";
  if (query.length === 0) {
    throw new Error("Missing query in job input");
  }

  return {
    summary: `Queued analysis (${query.length} characters).`,
    note: "Placeholder result. Wire a real model pass here when ready.",
    queryPreview: query.length > 200 ? `${query.slice(0, 200)}…` : query,
  };
}
