import "server-only";

import { saveMemoryRecord } from "@/lib/db/queries";
import type { BackgroundJob } from "@/lib/db/schema";

export type InsightLine = {
  text: string;
  data?: Record<string, unknown>;
};

/**
 * Writes observe + propose memories tied to a background job (metadata.sourceJobId).
 * Returns the number of proposal rows created.
 */
export async function persistJobInsights({
  job,
  insights,
  proposals,
}: {
  job: BackgroundJob;
  insights: InsightLine[];
  proposals: InsightLine[];
}): Promise<number> {
  const baseMeta = {
    sourceJobId: job.id,
    jobKind: job.kind,
  };

  for (const row of insights) {
    await saveMemoryRecord({
      userId: job.userId,
      kind: "fact",
      tier: "observe",
      content: row.text,
      metadata: { ...baseMeta, ...row.data, facet: "insight" },
    });
  }

  for (const row of proposals) {
    await saveMemoryRecord({
      userId: job.userId,
      kind: "opportunity",
      tier: "propose",
      content: row.text,
      proposedAt: new Date(),
      metadata: { ...baseMeta, ...row.data, facet: "proposal" },
    });
  }

  return proposals.length;
}

export function lookbackDaysFromJobInput(
  input: Record<string, unknown>,
  fallback = 45
): number {
  const raw = input.days;
  if (
    typeof raw === "number" &&
    Number.isFinite(raw) &&
    raw > 0 &&
    raw <= 365
  ) {
    return Math.floor(raw);
  }
  return fallback;
}

export function lookbackDate(days: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - days);
  d.setHours(0, 0, 0, 0);
  return d;
}
