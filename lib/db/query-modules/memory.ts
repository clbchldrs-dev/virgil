import "server-only";

import { and, desc, eq, gte, inArray, sql } from "drizzle-orm";
import { VirgilError } from "@/lib/errors";
import { client, db } from "../client";
import { type Memory, memory } from "../schema";

// --- Memory (companion assistant) ---

export async function saveMemoryRecord({
  userId,
  chatId,
  kind,
  content,
  metadata,
  tier = "observe",
  proposedAt,
  approvedAt,
  appliedAt,
}: {
  userId: string;
  chatId?: string;
  kind: "note" | "fact" | "goal" | "opportunity";
  content: string;
  metadata?: Record<string, unknown>;
  tier?: "observe" | "propose" | "act";
  proposedAt?: Date | null;
  approvedAt?: Date | null;
  appliedAt?: Date | null;
}) {
  try {
    const [created] = await db
      .insert(memory)
      .values({
        userId,
        chatId,
        kind,
        tier,
        content,
        metadata: metadata ?? {},
        proposedAt: proposedAt ?? null,
        approvedAt: approvedAt ?? null,
        appliedAt: appliedAt ?? null,
      })
      .returning();
    return created;
  } catch (_error) {
    throw new VirgilError("bad_request:database", "Failed to save memory");
  }
}

export async function approveMemoriesForUser({
  memoryIds,
  userId,
}: {
  memoryIds: string[];
  userId: string;
}): Promise<number> {
  if (memoryIds.length === 0) {
    return 0;
  }
  try {
    const now = new Date();
    const result = await db
      .update(memory)
      .set({ approvedAt: now, updatedAt: now })
      .where(and(eq(memory.userId, userId), inArray(memory.id, memoryIds)))
      .returning({ id: memory.id });
    return result.length;
  } catch (_error) {
    throw new VirgilError("bad_request:database", "Failed to approve memories");
  }
}

export async function searchMemories({
  userId,
  query,
  kind,
  limit = 10,
}: {
  userId: string;
  query: string;
  kind?: "note" | "fact" | "goal" | "opportunity";
  limit?: number;
}): Promise<Memory[]> {
  try {
    const sanitized = query.replace(/[^\w\s]/g, " ").trim();
    if (!sanitized) {
      return [];
    }

    const tsquery = sanitized.split(/\s+/).filter(Boolean).join(" & ");

    const params: (string | number)[] = [userId, tsquery, limit];
    let kindClause = "";
    if (kind) {
      params.push(kind);
      kindClause = `AND "kind" = $${params.length}`;
    }

    const result = await client.unsafe<Memory[]>(
      `SELECT "id", "userId", "chatId", "kind", "tier", "content", "metadata", "proposedAt", "approvedAt", "appliedAt", "createdAt", "updatedAt"
       FROM "Memory"
       WHERE "userId" = $1 ${kindClause}
         AND "tsv" @@ to_tsquery('english', $2)
       ORDER BY ts_rank("tsv", to_tsquery('english', $2)) DESC
       LIMIT $3`,
      params
    );
    return result;
  } catch (_error) {
    throw new VirgilError("bad_request:database", "Failed to search memories");
  }
}

export async function getMemoriesBySourceJobId({
  userId,
  jobId,
}: {
  userId: string;
  jobId: string;
}): Promise<Memory[]> {
  try {
    return await db
      .select()
      .from(memory)
      .where(
        and(
          eq(memory.userId, userId),
          sql`(${memory.metadata}->>'sourceJobId') = ${jobId}`
        )
      );
  } catch (_error) {
    throw new VirgilError(
      "bad_request:database",
      "Failed to load memories for job"
    );
  }
}

export async function getRecentMemories({
  userId,
  since,
  limit = 50,
}: {
  userId: string;
  since: Date;
  limit?: number;
}): Promise<Memory[]> {
  try {
    return await db
      .select()
      .from(memory)
      .where(and(eq(memory.userId, userId), gte(memory.createdAt, since)))
      .orderBy(desc(memory.createdAt))
      .limit(limit);
  } catch (_error) {
    throw new VirgilError(
      "bad_request:database",
      "Failed to get recent memories"
    );
  }
}
