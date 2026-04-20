import "server-only";

import { and, asc, eq, max } from "drizzle-orm";
import { VirgilError } from "@/lib/errors";
import { db } from "../client";
import { type DayTask, dayTask } from "../schema";

export async function listDayTasksForUser({
  userId,
  forDate,
}: {
  userId: string;
  forDate: string;
}): Promise<DayTask[]> {
  try {
    return await db
      .select()
      .from(dayTask)
      .where(and(eq(dayTask.userId, userId), eq(dayTask.forDate, forDate)))
      .orderBy(asc(dayTask.sortOrder), asc(dayTask.createdAt));
  } catch {
    throw new VirgilError("bad_request:database", "Failed to list day tasks");
  }
}

export async function createDayTaskForUser({
  userId,
  forDate,
  title,
}: {
  userId: string;
  forDate: string;
  title: string;
}): Promise<DayTask> {
  const trimmed = title.trim();
  if (!trimmed) {
    throw new VirgilError("bad_request:api", "Title is required");
  }
  try {
    const [agg] = await db
      .select({ m: max(dayTask.sortOrder) })
      .from(dayTask)
      .where(and(eq(dayTask.userId, userId), eq(dayTask.forDate, forDate)));
    const nextOrder = (agg?.m ?? -1) + 1;
    const [row] = await db
      .insert(dayTask)
      .values({
        userId,
        forDate,
        title: trimmed,
        sortOrder: nextOrder,
      })
      .returning();
    if (!row) {
      throw new VirgilError(
        "bad_request:database",
        "Failed to create day task"
      );
    }
    return row;
  } catch (error) {
    if (error instanceof VirgilError) {
      throw error;
    }
    throw new VirgilError("bad_request:database", "Failed to create day task");
  }
}

export async function getDayTaskByIdForUser({
  taskId,
  userId,
}: {
  taskId: string;
  userId: string;
}): Promise<DayTask | null> {
  try {
    const [row] = await db
      .select()
      .from(dayTask)
      .where(and(eq(dayTask.id, taskId), eq(dayTask.userId, userId)))
      .limit(1);
    return row ?? null;
  } catch {
    throw new VirgilError("bad_request:database", "Failed to load day task");
  }
}

export async function updateDayTaskForUser({
  taskId,
  userId,
  title,
  completed,
}: {
  taskId: string;
  userId: string;
  title?: string;
  completed?: boolean;
}): Promise<DayTask> {
  const existing = await getDayTaskByIdForUser({ taskId, userId });
  if (!existing) {
    throw new VirgilError("bad_request:api", "Task not found");
  }

  const now = new Date();
  let nextCompletedAt: Date | null = existing.completedAt;
  if (completed === true) {
    nextCompletedAt = now;
  } else if (completed === false) {
    nextCompletedAt = null;
  }

  const nextTitle = title === undefined ? existing.title : title.trim();
  if (!nextTitle) {
    throw new VirgilError("bad_request:api", "Title is required");
  }

  try {
    const [row] = await db
      .update(dayTask)
      .set({
        title: nextTitle,
        completedAt: nextCompletedAt,
        updatedAt: now,
      })
      .where(and(eq(dayTask.id, taskId), eq(dayTask.userId, userId)))
      .returning();
    if (!row) {
      throw new VirgilError(
        "bad_request:database",
        "Failed to update day task"
      );
    }
    return row;
  } catch (error) {
    if (error instanceof VirgilError) {
      throw error;
    }
    throw new VirgilError("bad_request:database", "Failed to update day task");
  }
}

export async function deleteDayTaskForUser({
  taskId,
  userId,
}: {
  taskId: string;
  userId: string;
}): Promise<void> {
  const existing = await getDayTaskByIdForUser({ taskId, userId });
  if (!existing) {
    throw new VirgilError("bad_request:api", "Task not found");
  }
  try {
    await db
      .delete(dayTask)
      .where(and(eq(dayTask.id, taskId), eq(dayTask.userId, userId)));
  } catch {
    throw new VirgilError("bad_request:database", "Failed to delete day task");
  }
}
