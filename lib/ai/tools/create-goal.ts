import { tool } from "ai";
import { z } from "zod";
import { createGoalForUser } from "@/lib/db/queries";

const categories = [
  "health",
  "career",
  "creative",
  "learning",
  "personal",
] as const;

export function createGoal({ userId }: { userId: string }) {
  return tool({
    description:
      "Create a structured goal for the user (cadence, category). Confirm the title and category if unclear.",
    inputSchema: z.object({
      title: z.string().describe("Short goal title"),
      category: z.enum(categories).describe("Goal category"),
      description: z.string().optional().describe("Optional detail"),
      targetCadence: z
        .enum(["daily", "weekly", "monthly"])
        .optional()
        .describe("How often the user intends to check in"),
    }),
    execute: async (input) => {
      const row = await createGoalForUser({
        userId,
        title: input.title,
        category: input.category,
        description: input.description,
        targetCadence: input.targetCadence,
      });
      return {
        success: true as const,
        goalId: row.id,
        message: `Created goal "${row.title}".`,
      };
    },
  });
}
