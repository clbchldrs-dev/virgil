import { tool } from "ai";
import { z } from "zod";
import { searchMemories } from "@/lib/db/queries";

export function recallMemory({ userId }: { userId: string }) {
  return tool({
    description:
      "Search your memory for relevant past context. Use BEFORE answering questions that might relate to previous conversations — goals, preferences, past decisions, facts the user shared. Also use when you hear something that might connect to an earlier topic.",
    inputSchema: z.object({
      query: z
        .string()
        .describe("Keywords or phrases to search for in memory"),
      kind: z
        .enum(["note", "fact", "goal", "opportunity"])
        .optional()
        .describe("Filter by memory type"),
    }),
    execute: async (input) => {
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
