import "server-only";

import { and, count, desc, eq, gte, inArray, isNull, sql } from "drizzle-orm";
import { VirgilError } from "@/lib/errors";
import { client, db } from "../client";
import { type Memory, memory } from "../schema";

const proposalNotDismissedClause = sql`(coalesce((${memory.metadata}->>'reviewDecision'), 'pending') <> 'dismissed')`;

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

export async function listMemoriesForUser({
  userId,
  kind,
  limit = 60,
}: {
  userId: string;
  kind?: "note" | "fact" | "goal" | "opportunity";
  limit?: number;
}): Promise<Memory[]> {
  try {
    const whereClause = kind
      ? and(eq(memory.userId, userId), eq(memory.kind, kind))
      : eq(memory.userId, userId);
    return await db
      .select()
      .from(memory)
      .where(whereClause)
      .orderBy(desc(memory.createdAt))
      .limit(Math.min(limit, 200));
  } catch (_error) {
    throw new VirgilError(
      "bad_request:database",
      "Failed to list memories for user"
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

/** Tier-2 proposal memories (ADR-002); distinct from night-review source filter. */
export async function getProposalMemoriesForUser({
  userId,
  since,
  limit = 60,
  includeDismissed = false,
}: {
  userId: string;
  since: Date;
  limit?: number;
  includeDismissed?: boolean;
}): Promise<Memory[]> {
  try {
    return await db
      .select()
      .from(memory)
      .where(
        and(
          eq(memory.userId, userId),
          eq(memory.tier, "propose"),
          gte(memory.createdAt, since),
          ...(includeDismissed ? [] : [proposalNotDismissedClause])
        )
      )
      .orderBy(desc(memory.createdAt))
      .limit(Math.min(limit ?? 60, 200));
  } catch (_error) {
    throw new VirgilError(
      "bad_request:database",
      "Failed to get proposal memories"
    );
  }
}

/**
 * Proposals still awaiting accept/dismiss (tier propose, not dismissed, not approved).
 */
export async function countPendingProposalsForUser({
  userId,
  since,
}: {
  userId: string;
  since: Date;
}): Promise<number> {
  try {
    const [row] = await db
      .select({ c: count() })
      .from(memory)
      .where(
        and(
          eq(memory.userId, userId),
          eq(memory.tier, "propose"),
          gte(memory.createdAt, since),
          proposalNotDismissedClause,
          isNull(memory.approvedAt)
        )
      );
    return Number(row?.c ?? 0);
  } catch (_error) {
    throw new VirgilError(
      "bad_request:database",
      "Failed to count pending proposals"
    );
  }
}

export async function setProposalMemoryDecision({
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
      throw new VirgilError("not_found:memory");
    }
    if (row.tier !== "propose") {
      throw new VirgilError("forbidden:memory");
    }

    const meta = row.metadata as Record<string, unknown>;
    const now = new Date();
    const nextMetadata = {
      ...meta,
      reviewDecision: decision,
      reviewedAt: now.toISOString(),
    };

    if (decision === "accepted") {
      const [updated] = await db
        .update(memory)
        .set({
          approvedAt: now,
          metadata: nextMetadata,
          updatedAt: now,
        })
        .where(eq(memory.id, memoryId))
        .returning();
      if (!updated) {
        throw new VirgilError(
          "bad_request:database",
          "Failed to update memory"
        );
      }
      return updated;
    }

    const [updated] = await db
      .update(memory)
      .set({
        metadata: nextMetadata,
        updatedAt: now,
      })
      .where(eq(memory.id, memoryId))
      .returning();

    if (!updated) {
      throw new VirgilError("bad_request:database", "Failed to update memory");
    }
    return updated;
  } catch (error) {
    if (error instanceof VirgilError) {
      throw error;
    }
    throw new VirgilError(
      "bad_request:database",
      "Failed to set proposal memory decision"
    );
  }
}
