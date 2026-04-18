import { tool } from "ai";
import { z } from "zod";
import { isMem0Configured, mem0Search } from "@/lib/ai/mem0-client";
import {
  searchMemories,
  searchMemoriesByVectorFromQueryText,
} from "@/lib/db/queries";
import type { Memory } from "@/lib/db/schema";
import { agentIngestLogSession308ef5 } from "@/lib/debug/agent-ingest-log";

/** Raw SQL (`client.unsafe`) often returns timestamps as strings; Drizzle select returns Date. */
function memorySavedAtIso(createdAt: unknown): string {
  if (createdAt instanceof Date && !Number.isNaN(createdAt.getTime())) {
    return createdAt.toISOString();
  }
  if (typeof createdAt === "string" || typeof createdAt === "number") {
    const parsed = new Date(createdAt);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed.toISOString();
    }
  }
  return new Date().toISOString();
}

function mapDbMemories(results: Memory[]) {
  return {
    found: true as const,
    count: results.length,
    memories: results.map((m) => ({
      kind: m.kind,
      content: m.content,
      savedAt: memorySavedAtIso(m.createdAt),
    })),
  };
}

export function recallMemory({ userId }: { userId: string }) {
  return tool({
    description:
      "Search your memory for relevant past context. Use BEFORE answering questions that might relate to previous conversations — goals, preferences, past decisions, facts the user shared. Also use when you hear something that might connect to an earlier topic.",
    inputSchema: z.object({
      query: z
        .string()
        .describe(
          "Natural-language query describing what to recall (e.g. 'what are the user goals for retirement')"
        ),
      kind: z
        .enum(["note", "fact", "goal", "opportunity"])
        .optional()
        .describe("Filter by memory type"),
    }),
    execute: async (input) => {
      // #region agent log
      agentIngestLogSession308ef5({
        runId: "verify",
        hypothesisId: "H0",
        location: "recall-memory.ts:execute:start",
        message: "recallMemory execute",
        data: {
          queryLen: input.query.length,
          kind: input.kind ?? null,
        },
      });
      // #endregion
      const vectorResults = await searchMemoriesByVectorFromQueryText({
        userId,
        query: input.query,
        kind: input.kind,
        limit: 8,
      });
      // #region agent log
      agentIngestLogSession308ef5({
        runId: "verify",
        hypothesisId: "H3",
        location: "recall-memory.ts:after-vector",
        message: "vector branch result",
        data: { vectorCount: vectorResults.length },
      });
      // #endregion
      if (vectorResults.length > 0) {
        return mapDbMemories(vectorResults);
      }

      const ftsResults = await searchMemories({
        userId,
        query: input.query,
        kind: input.kind,
        limit: 8,
      });
      if (ftsResults.length > 0) {
        return mapDbMemories(ftsResults);
      }

      if (isMem0Configured()) {
        const mem0Results = await mem0Search(input.query, userId, {
          limit: 8,
          ...(input.kind ? { categories: [input.kind] } : {}),
        });

        if (mem0Results.length > 0) {
          return {
            found: true,
            count: mem0Results.length,
            memories: mem0Results.map((m) => ({
              kind: m.categories?.at(0) ?? "note",
              content: m.memory ?? "",
              savedAt: m.createdAt
                ? new Date(m.createdAt).toISOString()
                : new Date().toISOString(),
            })),
          };
        }
      }

      return { found: false, message: "No relevant memories found." };
    },
  });
}
