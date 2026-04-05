import "server-only";

import { asc, desc, eq } from "drizzle-orm";
import { VirgilError } from "@/lib/errors";
import { db } from "../client";
import { sophonDailyReview, sophonTask } from "../schema";

export async function listSophonTasksForUser({ userId }: { userId: string }) {
  try {
    return await db
      .select()
      .from(sophonTask)
      .where(eq(sophonTask.userId, userId))
      .orderBy(asc(sophonTask.dueAt), desc(sophonTask.createdAt))
      .limit(200);
  } catch (_error) {
    throw new VirgilError(
      "bad_request:database",
      "Failed to list Sophon tasks"
    );
  }
}

export async function upsertSophonDailyReviewForUser({
  userId,
  reviewDate,
  wins,
  misses,
  carryForward,
  calibration,
}: {
  userId: string;
  reviewDate: string;
  wins: string[];
  misses: string[];
  carryForward: string[];
  calibration: Record<string, unknown>;
}) {
  try {
    const [row] = await db
      .insert(sophonDailyReview)
      .values({
        userId,
        reviewDate,
        wins,
        misses,
        carryForward,
        calibration,
      })
      .onConflictDoUpdate({
        target: [sophonDailyReview.userId, sophonDailyReview.reviewDate],
        set: {
          wins,
          misses,
          carryForward,
          calibration,
          updatedAt: new Date(),
        },
      })
      .returning();
    return row;
  } catch (_error) {
    throw new VirgilError(
      "bad_request:database",
      "Failed to upsert Sophon daily review"
    );
  }
}
