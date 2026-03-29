import "server-only";

import { and, desc, eq, gte } from "drizzle-orm";
import { ChatbotError } from "@/lib/errors";
import { client, db } from "../client";
import { type Memory, memory } from "../schema";

// --- Memory (companion assistant) ---

export async function saveMemoryRecord({
  userId,
  chatId,
  kind,
  content,
  metadata,
}: {
  userId: string;
  chatId?: string;
  kind: "note" | "fact" | "goal" | "opportunity";
  content: string;
  metadata?: Record<string, unknown>;
}) {
  try {
    const [created] = await db
      .insert(memory)
      .values({ userId, chatId, kind, content, metadata: metadata ?? {} })
      .returning();
    return created;
  } catch (_error) {
    throw new ChatbotError("bad_request:database", "Failed to save memory");
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
      `SELECT "id", "userId", "chatId", "kind", "content", "metadata", "createdAt", "updatedAt"
       FROM "Memory"
       WHERE "userId" = $1 ${kindClause}
         AND "tsv" @@ to_tsquery('english', $2)
       ORDER BY ts_rank("tsv", to_tsquery('english', $2)) DESC
       LIMIT $3`,
      params
    );
    return result;
  } catch (_error) {
    throw new ChatbotError("bad_request:database", "Failed to search memories");
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
    throw new ChatbotError(
      "bad_request:database",
      "Failed to get recent memories"
    );
  }
}
