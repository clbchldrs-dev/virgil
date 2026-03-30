import "server-only";

import { and, desc, eq } from "drizzle-orm";
import { VirgilError } from "@/lib/errors";
import { db } from "../client";
import { blockerIncident, goalWeeklySnapshot } from "../schema";

export async function upsertGoalWeeklySnapshot({
  userId,
  weekEnding,
  metrics,
}: {
  userId: string;
  /** ISO date string YYYY-MM-DD (Postgres `date`). */
  weekEnding: string;
  metrics: Record<string, unknown>;
}) {
  try {
    const [row] = await db
      .insert(goalWeeklySnapshot)
      .values({
        userId,
        weekEnding,
        metrics,
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: [goalWeeklySnapshot.userId, goalWeeklySnapshot.weekEnding],
        set: {
          metrics,
          updatedAt: new Date(),
        },
      })
      .returning();
    return row;
  } catch (_error) {
    throw new VirgilError(
      "bad_request:database",
      "Failed to save weekly goal snapshot"
    );
  }
}

export async function listRecentGoalWeeklySnapshots({
  userId,
  limit = 4,
}: {
  userId: string;
  limit?: number;
}) {
  try {
    return await db
      .select()
      .from(goalWeeklySnapshot)
      .where(eq(goalWeeklySnapshot.userId, userId))
      .orderBy(desc(goalWeeklySnapshot.weekEnding))
      .limit(limit);
  } catch (_error) {
    throw new VirgilError(
      "bad_request:database",
      "Failed to list weekly goal snapshots"
    );
  }
}

export async function saveBlockerIncident({
  userId,
  chatId,
  blockerKey,
  summary,
  triggerGuess,
  mitigationNote,
  metadata,
  occurredAt,
}: {
  userId: string;
  chatId?: string;
  blockerKey: string;
  summary: string;
  triggerGuess?: string;
  mitigationNote?: string;
  metadata?: Record<string, unknown>;
  occurredAt?: Date;
}) {
  try {
    const [row] = await db
      .insert(blockerIncident)
      .values({
        userId,
        chatId,
        blockerKey,
        summary,
        triggerGuess,
        mitigationNote,
        metadata: metadata ?? {},
        occurredAt: occurredAt ?? new Date(),
      })
      .returning();
    return row;
  } catch (_error) {
    throw new VirgilError(
      "bad_request:database",
      "Failed to save blocker incident"
    );
  }
}

export async function listRecentBlockerIncidents({
  userId,
  blockerKey,
  limit = 12,
}: {
  userId: string;
  blockerKey?: string;
  limit?: number;
}) {
  try {
    const condition = blockerKey
      ? and(
          eq(blockerIncident.userId, userId),
          eq(blockerIncident.blockerKey, blockerKey)
        )
      : eq(blockerIncident.userId, userId);

    return await db
      .select()
      .from(blockerIncident)
      .where(condition)
      .orderBy(desc(blockerIncident.occurredAt))
      .limit(limit);
  } catch (_error) {
    throw new VirgilError(
      "bad_request:database",
      "Failed to list blocker incidents"
    );
  }
}
