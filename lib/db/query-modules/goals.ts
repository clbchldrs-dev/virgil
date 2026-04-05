import "server-only";

import { and, desc, eq, lt } from "drizzle-orm";
import { VirgilError } from "@/lib/errors";
import { db } from "../client";
import { type Goal, goal, goalCheckIn } from "../schema";

export async function listActiveGoalsForUser({
  userId,
  limit = 12,
}: {
  userId: string;
  limit?: number;
}): Promise<Goal[]> {
  try {
    return await db
      .select()
      .from(goal)
      .where(and(eq(goal.userId, userId), eq(goal.status, "active")))
      .orderBy(desc(goal.lastTouchedAt))
      .limit(Math.min(limit, 50));
  } catch {
    throw new VirgilError("bad_request:database", "Failed to list goals");
  }
}

export async function getStaleGoalsForUser({
  userId,
  thresholdDays,
  limit = 20,
}: {
  userId: string;
  thresholdDays: number;
  limit?: number;
}): Promise<Goal[]> {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - thresholdDays);
  try {
    return await db
      .select()
      .from(goal)
      .where(
        and(
          eq(goal.userId, userId),
          eq(goal.status, "active"),
          lt(goal.lastTouchedAt, cutoff)
        )
      )
      .orderBy(goal.lastTouchedAt)
      .limit(Math.min(limit, 100));
  } catch {
    throw new VirgilError("bad_request:database", "Failed to load stale goals");
  }
}

export async function createGoalForUser({
  userId,
  title,
  category,
  description,
  targetCadence,
}: {
  userId: string;
  title: string;
  category: string;
  description?: string;
  targetCadence?: string;
}): Promise<Goal> {
  try {
    const [row] = await db
      .insert(goal)
      .values({
        userId,
        title,
        category,
        description: description ?? null,
        targetCadence: targetCadence ?? null,
        status: "active",
      })
      .returning();
    if (!row) {
      throw new VirgilError("bad_request:database", "Failed to create goal");
    }
    return row;
  } catch (error) {
    if (error instanceof VirgilError) {
      throw error;
    }
    throw new VirgilError("bad_request:database", "Failed to create goal");
  }
}

export async function getGoalByIdForUser({
  goalId,
  userId,
}: {
  goalId: string;
  userId: string;
}): Promise<Goal | null> {
  try {
    const [row] = await db
      .select()
      .from(goal)
      .where(and(eq(goal.id, goalId), eq(goal.userId, userId)))
      .limit(1);
    return row ?? null;
  } catch {
    throw new VirgilError("bad_request:database", "Failed to load goal");
  }
}

export async function recordGoalCheckIn({
  goalId,
  userId,
  notes,
  source = "manual",
}: {
  goalId: string;
  userId: string;
  notes?: string;
  source?: "manual" | "inferred" | "event";
}): Promise<{ goal: Goal }> {
  const existing = await getGoalByIdForUser({ goalId, userId });
  if (!existing) {
    throw new VirgilError("bad_request:api", "Goal not found");
  }
  if (existing.status !== "active") {
    throw new VirgilError("bad_request:api", "Goal is not active");
  }

  try {
    await db.insert(goalCheckIn).values({
      goalId,
      notes: notes ?? null,
      source,
    });
    const nextStreak = existing.streakCurrent + 1;
    const nextBest = Math.max(existing.streakBest, nextStreak);
    const now = new Date();
    const [updated] = await db
      .update(goal)
      .set({
        streakCurrent: nextStreak,
        streakBest: nextBest,
        lastTouchedAt: now,
        updatedAt: now,
      })
      .where(eq(goal.id, goalId))
      .returning();
    if (!updated) {
      throw new VirgilError("bad_request:database", "Failed to update goal");
    }
    return { goal: updated };
  } catch (error) {
    if (error instanceof VirgilError) {
      throw error;
    }
    throw new VirgilError("bad_request:database", "Failed to record check-in");
  }
}
