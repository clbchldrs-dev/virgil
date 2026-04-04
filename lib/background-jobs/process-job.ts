import "server-only";

import {
  claimBackgroundJob,
  completeBackgroundJob,
  failBackgroundJob,
} from "@/lib/db/queries";
import { runDeepAnalysisStub } from "./deep-analysis-stub";
import { handlers } from "./handlers";

export async function processBackgroundJobById(jobId: string): Promise<void> {
  const claimed = await claimBackgroundJob(jobId);
  if (!claimed) {
    return;
  }

  const started = Date.now();

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
      await failBackgroundJob({
        id: jobId,
        message: handlerResult.error ?? "Handler returned failure",
        wallTimeMs: Date.now() - started,
      });
      return;
    }

    await completeBackgroundJob({
      id: jobId,
      result: handlerResult.data ?? {},
      wallTimeMs: Date.now() - started,
      proposalCount: handlerResult.proposalCount,
    });
  } catch (error) {
    await failBackgroundJob({
      id: jobId,
      message: error instanceof Error ? error.message : String(error),
      wallTimeMs: Date.now() - started,
    });
  }
}
