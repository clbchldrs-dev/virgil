import { tool } from "ai";
import { z } from "zod";
import { isMem0Configured, mem0Search } from "@/lib/ai/mem0-client";
import { searchMemories } from "@/lib/db/queries";

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
              savedAt: m.created_at
                ? new Date(m.created_at).toISOString()
                : new Date().toISOString(),
            })),
          };
        }
      }

      const results = await searchMemories({
        userId,
        query: input.query,
        kind: input.kind,
        limit: 8,
      });

      if (results.length === 0) {
        return { found: false, message: "No relevant memories found." };
      }

      return {
        found: true,
        count: results.length,
        memories: results.map((m) => ({
          kind: m.kind,
          content: m.content,
          savedAt: m.createdAt.toISOString(),
        })),
      };
    },
  });
}
