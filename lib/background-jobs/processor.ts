import "server-only";

import { and, asc, eq, gte } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { updateJobStatus } from "@/lib/db/queries";
import { backgroundJob } from "@/lib/db/schema";
import { processBackgroundJobById } from "./process-job";

const IDLE_MS = 100;
const ERROR_BACKOFF_MS = 1000;

/**
 * Long-running worker loop (local daemon or dedicated process). Not for
 * serverless request handlers — use QStash + `/api/background/jobs/run` instead.
 */
export async function processQueue(): Promise<never> {
  while (true) {
    try {
      const [pendingJob] = await db
        .select()
        .from(backgroundJob)
        .where(eq(backgroundJob.status, "pending"))
        .orderBy(asc(backgroundJob.createdAt))
        .limit(1);

      if (!pendingJob) {
        await new Promise<void>((resolve) => {
          setTimeout(resolve, IDLE_MS);
        });
        continue;
      }

      if (pendingJob.kind === "nightly_review") {
        const alreadyRan = await checkNightlyAlreadyRan(
          pendingJob.userId,
          pendingJob.createdAt
        );
        if (alreadyRan) {
          await updateJobStatus(
            pendingJob.id,
            "cancelled",
            "Nightly already ran today"
          );
          continue;
        }
      }

      await processBackgroundJobById(pendingJob.id);
    } catch {
      await new Promise<void>((resolve) => {
        setTimeout(resolve, ERROR_BACKOFF_MS);
      });
    }
  }
}

async function checkNightlyAlreadyRan(
  userId: string,
  jobCreatedAt: Date
): Promise<boolean> {
  const today = new Date(jobCreatedAt);
  today.setHours(0, 0, 0, 0);

  const [completedNightly] = await db
    .select({ id: backgroundJob.id })
    .from(backgroundJob)
    .where(
      and(
        eq(backgroundJob.userId, userId),
        eq(backgroundJob.kind, "nightly_review"),
        gte(backgroundJob.createdAt, today),
        eq(backgroundJob.status, "completed")
      )
    )
    .limit(1);

  return Boolean(completedNightly);
}
