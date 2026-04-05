import "server-only";

import { desc, eq } from "drizzle-orm";
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
}: {
  userId: string;
  limit?: number;
}) {
  try {
    const cap = Math.min(Math.max(1, limit), 100);
    return await db
      .select()
      .from(healthSnapshot)
      .where(eq(healthSnapshot.userId, userId))
      .orderBy(desc(healthSnapshot.createdAt))
      .limit(cap);
  } catch (_error) {
    throw new VirgilError(
      "bad_request:database",
      "Failed to list health snapshots"
    );
  }
}
