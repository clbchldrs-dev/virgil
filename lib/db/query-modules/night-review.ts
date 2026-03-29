import "server-only";

import { and, asc, count, desc, eq, gte, lte, sql } from "drizzle-orm";
import { ChatbotError } from "@/lib/errors";
import { db } from "../client";
import {
  chat,
  type DBMessage,
  type Memory,
  memory,
  message,
  nightReviewRun,
} from "../schema";

const notDismissedClause = sql`(coalesce((${memory.metadata}->>'reviewDecision'), 'pending') <> 'dismissed')`;

export async function saveNightReviewRunLog({
  userId,
  windowKey,
  runId,
  modelId,
  outcome,
  durationMs,
  error,
}: {
  userId: string;
  windowKey: string;
  runId: string;
  modelId: string;
  outcome: "ok" | "findings" | "skipped" | "error";
  durationMs: number;
  error?: string;
}) {
  try {
    await db.insert(nightReviewRun).values({
      userId,
      windowKey,
      runId,
      modelId,
      outcome,
      durationMs,
      error: error ?? null,
    });
  } catch (_error) {
    throw new ChatbotError(
      "bad_request:database",
      "Failed to save night review run log"
    );
  }
}

/** Recent memories produced by the night-review job (for in-app surfacing). */
export async function getNightReviewMemoriesForUser({
  userId,
  since,
  limit = 40,
  includeDismissed = false,
}: {
  userId: string;
  since: Date;
  limit?: number;
  /** When false, rows with metadata.reviewDecision === 'dismissed' are omitted. */
  includeDismissed?: boolean;
}): Promise<Memory[]> {
  try {
    return await db
      .select()
      .from(memory)
      .where(
        and(
          eq(memory.userId, userId),
          gte(memory.createdAt, since),
          sql`(${memory.metadata}->>'source') = 'night-review'`,
          ...(includeDismissed ? [] : [notDismissedClause])
        )
      )
      .orderBy(desc(memory.createdAt))
      .limit(limit);
  } catch (_error) {
    throw new ChatbotError(
      "bad_request:database",
      "Failed to get night review memories"
    );
  }
}

export async function setNightReviewMemoryDecision({
  userId,
  memoryId,
  decision,
}: {
  userId: string;
  memoryId: string;
  decision: "accepted" | "dismissed";
}): Promise<Memory> {
  try {
    const [row] = await db
      .select()
      .from(memory)
      .where(and(eq(memory.id, memoryId), eq(memory.userId, userId)))
      .limit(1);

    if (!row) {
      throw new ChatbotError("not_found:memory");
    }

    const meta = row.metadata as Record<string, unknown>;
    if (meta.source !== "night-review") {
      throw new ChatbotError("forbidden:memory");
    }
    if (String(meta.phase ?? "") === "complete") {
      throw new ChatbotError("bad_request:api");
    }

    const nextMetadata = {
      ...meta,
      reviewDecision: decision,
      reviewedAt: new Date().toISOString(),
    };

    const [updated] = await db
      .update(memory)
      .set({ metadata: nextMetadata, updatedAt: new Date() })
      .where(eq(memory.id, memoryId))
      .returning();

    if (!updated) {
      throw new ChatbotError("bad_request:database", "Failed to update memory");
    }
    return updated;
  } catch (error) {
    if (error instanceof ChatbotError) {
      throw error;
    }
    throw new ChatbotError(
      "bad_request:database",
      "Failed to set night review memory decision"
    );
  }
}

/** True if a finished night-review exists for this user + window key (idempotency). */
export async function hasCompletedNightReviewForWindow({
  userId,
  windowKey,
}: {
  userId: string;
  windowKey: string;
}): Promise<boolean> {
  try {
    const rows = await db
      .select({ id: memory.id })
      .from(memory)
      .where(
        and(
          eq(memory.userId, userId),
          sql`(${memory.metadata}->>'source') = 'night-review'`,
          sql`(${memory.metadata}->>'windowKey') = ${windowKey}`,
          sql`(${memory.metadata}->>'phase') = 'complete'`
        )
      )
      .limit(1);
    return rows.length > 0;
  } catch (_error) {
    throw new ChatbotError(
      "bad_request:database",
      "Failed to check night review idempotency"
    );
  }
}

export type NightReviewMessageRow = {
  message: DBMessage;
  chatId: string;
  chatTitle: string;
};

/**
 * Messages for a user across all chats in [windowStart, windowEnd], oldest first.
 * Bounded to protect the night job from pathological histories.
 */
export async function getMessagesForUserInWindow({
  userId,
  windowStart,
  windowEnd,
  limit = 2000,
}: {
  userId: string;
  windowStart: Date;
  windowEnd: Date;
  limit?: number;
}): Promise<NightReviewMessageRow[]> {
  try {
    return await db
      .select({
        message,
        chatId: chat.id,
        chatTitle: chat.title,
      })
      .from(message)
      .innerJoin(chat, eq(message.chatId, chat.id))
      .where(
        and(
          eq(chat.userId, userId),
          gte(message.createdAt, windowStart),
          lte(message.createdAt, windowEnd)
        )
      )
      .orderBy(asc(message.createdAt))
      .limit(limit);
  } catch (_error) {
    throw new ChatbotError(
      "bad_request:database",
      "Failed to load messages for night review"
    );
  }
}

export async function countMessagesForUserInWindow({
  userId,
  windowStart,
  windowEnd,
}: {
  userId: string;
  windowStart: Date;
  windowEnd: Date;
}): Promise<number> {
  try {
    const [row] = await db
      .select({ c: count() })
      .from(message)
      .innerJoin(chat, eq(message.chatId, chat.id))
      .where(
        and(
          eq(chat.userId, userId),
          gte(message.createdAt, windowStart),
          lte(message.createdAt, windowEnd)
        )
      );
    return Number(row?.c ?? 0);
  } catch (_error) {
    throw new ChatbotError(
      "bad_request:database",
      "Failed to count messages for night review"
    );
  }
}
