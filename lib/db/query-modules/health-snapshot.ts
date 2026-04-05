import "server-only";

import { and, desc, eq, gte } from "drizzle-orm";
import { VirgilError } from "@/lib/errors";
import { db } from "../client";
import { healthSnapshot } from "../schema";

export async function insertHealthSnapshot({
  userId,
  periodStart,
  periodEnd,
  source,
  payload,
}: {
  userId: string;
  periodStart: Date;
  periodEnd: Date;
  source: string;
  payload: Record<string, unknown>;
}) {
  try {
    const [row] = await db
      .insert(healthSnapshot)
      .values({
        userId,
        periodStart,
        periodEnd,
        source,
        payload,
      })
      .returning();
    return row;
  } catch (_error) {
    throw new VirgilError(
      "bad_request:database",
      "Failed to save health snapshot"
    );
  }
}

export async function listHealthSnapshotsForUser({
  userId,
  limit = 20,
  createdAfter,
}: {
  userId: string;
  limit?: number;
  /** When set, only snapshots with `createdAt` at or after this instant are returned. */
  createdAfter?: Date;
}) {
  try {
    const cap = Math.min(Math.max(1, limit), 100);
    const whereClause = createdAfter
      ? and(
          eq(healthSnapshot.userId, userId),
          gte(healthSnapshot.createdAt, createdAfter)
        )
      : eq(healthSnapshot.userId, userId);
    return await db
      .select()
      .from(healthSnapshot)
      .where(whereClause)
      .orderBy(desc(healthSnapshot.createdAt))
      .limit(cap);
  } catch (_error) {
    throw new VirgilError(
      "bad_request:database",
      "Failed to list health snapshots"
    );
  }
}
