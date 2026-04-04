import "server-only";

import { Client } from "@upstash/qstash";
import { after } from "next/server";
import { processBackgroundJobById } from "./process-job";

function getBaseUrl(): string {
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`;
  }
  return process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
}

/**
 * Runs the job after the HTTP response: QStash when configured, otherwise
 * `after()` on the same runtime (fine for local dev).
 */
export function scheduleBackgroundJobProcessing(jobId: string): void {
  const token = process.env.QSTASH_TOKEN?.trim();
  if (token) {
    const client = new Client({ token });
    client
      .publishJSON({
        url: `${getBaseUrl()}/api/background/jobs/run`,
        body: { jobId },
      })
      .catch(() => {
        /* QStash publish is fire-and-forget; errors surface in logs elsewhere */
      });
    return;
  }

  after(async () => {
    await processBackgroundJobById(jobId);
  });
}
