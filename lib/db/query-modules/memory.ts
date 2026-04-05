import "server-only";

import { and, count, desc, eq, gte, inArray, isNull, sql } from "drizzle-orm";
import {
  embedText,
  MEMORY_VECTOR_DIMENSIONS,
  vectorLiteralForPg,
} from "@/lib/ai/embeddings";
import { agentIngestLogSession308ef5 } from "@/lib/debug/agent-ingest-log";
import { VirgilError } from "@/lib/errors";
import { client, db } from "../client";
import { type Memory, memory } from "../schema";

const proposalNotDismissedClause = sql`(coalesce((${memory.metadata}->>'reviewDecision'), 'pending') <> 'dismissed')`;

// --- Memory (companion assistant) ---

export async function embedAndStoreMemoryVector(
  memoryId: string,
  content: string
): Promise<void> {
  const vec = await embedText(content);
  if (!vec || vec.length !== MEMORY_VECTOR_DIMENSIONS) {
    return;
  }
  const literal = vectorLiteralForPg(vec);
  await client.unsafe(
    `UPDATE "Memory" SET "embedding" = $1::vector(${MEMORY_VECTOR_DIMENSIONS}), "updatedAt" = now() WHERE "id" = $2::uuid`,
    [literal, memoryId]
  );
}

export async function searchMemoriesByVector({
  userId,
  queryVector,
  kind,
  limit = 8,
}: {
  userId: string;
  queryVector: number[];
  kind?: "note" | "fact" | "goal" | "opportunity";
  limit?: number;
}): Promise<Memory[]> {
  if (queryVector.length !== MEMORY_VECTOR_DIMENSIONS) {
    return [];
  }
  const literal = vectorLiteralForPg(queryVector);
  try {
    if (kind) {
      return await client.unsafe<Memory[]>(
        `SELECT "id", "userId", "chatId", "kind", "tier", "content", "metadata", "proposedAt", "approvedAt", "appliedAt", "createdAt", "updatedAt"
         FROM "Memory"
         WHERE "userId" = $1::uuid
           AND "embedding" IS NOT NULL
           AND "kind" = $4::varchar
         ORDER BY "embedding" <=> $2::vector(${MEMORY_VECTOR_DIMENSIONS})
         LIMIT $3`,
        [userId, literal, limit, kind]
      );
    }
    return await client.unsafe<Memory[]>(
      `SELECT "id", "userId", "chatId", "kind", "tier", "content", "metadata", "proposedAt", "approvedAt", "appliedAt", "createdAt", "updatedAt"
       FROM "Memory"
       WHERE "userId" = $1::uuid
         AND "embedding" IS NOT NULL
       ORDER BY "embedding" <=> $2::vector(${MEMORY_VECTOR_DIMENSIONS})
       LIMIT $3`,
      [userId, literal, limit]
    );
  } catch (error) {
    // #region agent log
    const err = error as { message?: string; code?: string };
    agentIngestLogSession308ef5({
      runId: "verify",
      hypothesisId: "H3-H5",
      location: "memory.ts:searchMemoriesByVector:catch",
      message: "Vector memory search failed (swallowed)",
      data: {
        hasKind: Boolean(kind),
        pgMessage: err.message?.slice(0, 500),
        pgCode: err.code,
      },
    });
    // #endregion
    return [];
  }
}

export async function searchMemoriesByVectorFromQueryText({
  userId,
  query,
  kind,
  limit = 8,
}: {
  userId: string;
  query: string;
  kind?: "note" | "fact" | "goal" | "opportunity";
  limit?: number;
}): Promise<Memory[]> {
  const queryVector = await embedText(query);
  if (!queryVector || queryVector.length !== MEMORY_VECTOR_DIMENSIONS) {
    return [];
  }
  return searchMemoriesByVector({ userId, queryVector, kind, limit });
}

export async function memoryExistsWithSourceDateAndContent({
  userId,
  content,
  source,
  date,
}: {
  userId: string;
  content: string;
  source: string;
  date: string;
}): Promise<boolean> {
  try {
    const rows = await db
      .select({ id: memory.id })
      .from(memory)
      .where(
        and(
          eq(memory.userId, userId),
          eq(memory.content, content),
          sql`(${memory.metadata}->>'source') = ${source}`,
          sql`(${memory.metadata}->>'date') = ${date}`
        )
      )
      .limit(1);
    return rows.length > 0;
  } catch (_error) {
    return false;
  }
}

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
    if (created) {
      embedAndStoreMemoryVector(created.id, created.content).catch(() => {
        /* fire-and-forget embedding; failures are non-blocking */
      });
    }
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

    const params: (string | number)[] = [userId, sanitized, limit];
    let kindClause = "";
    if (kind) {
      params.push(kind);
      kindClause = `AND "kind" = $${params.length}`;
    }

    // #region agent log
    agentIngestLogSession308ef5({
      runId: "verify",
      hypothesisId: "H1",
      location: "memory.ts:searchMemories:before-fts",
      message: "FTS plainto_tsquery params",
      data: {
        sanitizedLen: sanitized.length,
        sanitizedPreview: sanitized.slice(0, 120),
        wordCount: sanitized.split(/\s+/).filter(Boolean).length,
      },
    });
    // #endregion
    const result = await client.unsafe<Memory[]>(
      `SELECT "id", "userId", "chatId", "kind", "tier", "content", "metadata", "proposedAt", "approvedAt", "appliedAt", "createdAt", "updatedAt"
       FROM "Memory"
       WHERE "userId" = $1 ${kindClause}
         AND "tsv" @@ plainto_tsquery('english', $2)
       ORDER BY ts_rank("tsv", plainto_tsquery('english', $2)) DESC
       LIMIT $3`,
      params
    );
    return result;
  } catch (error) {
    // #region agent log
    const err = error as { message?: string; code?: string; detail?: string };
    agentIngestLogSession308ef5({
      runId: "verify",
      hypothesisId: "H1-H2-H4",
      location: "memory.ts:searchMemories:catch",
      message: "FTS search failed",
      data: {
        pgMessage: err.message?.slice(0, 500),
        pgCode: err.code,
        pgDetail: err.detail?.slice(0, 200),
      },
    });
    // #endregion
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
