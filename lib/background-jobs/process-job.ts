import "server-only";

import {
  claimBackgroundJob,
  completeBackgroundJob,
  failBackgroundJob,
  updateJobStatus,
} from "@/lib/db/query-modules/background-jobs";
import { runDeepAnalysisStub } from "./deep-analysis-stub";
import { handlers } from "./handlers";

/** PROMPT 4: matches blueprint (3 attempts, exponential backoff). */
const MAX_RETRIES = 3;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

/**
 * Claims the job, runs the handler with retries (handlers should be idempotent
 * if they perform side effects — a failed `completeBackgroundJob` will re-run the handler).
 */
export async function processBackgroundJobById(jobId: string): Promise<void> {
  const claimed = await claimBackgroundJob(jobId);
  if (!claimed) {
    return;
  }

  const started = Date.now();

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      if (claimed.kind === "deep_analysis") {
        const result = await runDeepAnalysisStub(claimed);
        await completeBackgroundJob({
          id: jobId,
          result,
          wallTimeMs: Date.now() - started,
        });
        return;
      }

      const handler = handlers[claimed.kind];
      if (!handler) {
        await failBackgroundJob({
          id: jobId,
          message: `Unsupported job kind: ${claimed.kind}`,
          wallTimeMs: Date.now() - started,
        });
        return;
      }

      const handlerResult = await handler(claimed);
      if (!handlerResult.success) {
        throw new Error(handlerResult.error ?? "Handler returned failure");
      }

      await completeBackgroundJob({
        id: jobId,
        result: handlerResult.data ?? {},
        wallTimeMs: Date.now() - started,
        proposalCount: handlerResult.proposalCount,
      });
      return;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (attempt < MAX_RETRIES - 1) {
        const waitMs = 2 ** (attempt + 1) * 1000;
        await updateJobStatus(claimed.id, "running", "Retrying after failure", {
          retryIncrement: true,
        });
        await sleep(waitMs);
        continue;
      }
      await failBackgroundJob({
        id: jobId,
        message,
        wallTimeMs: Date.now() - started,
      });
      return;
    }
  }
}
