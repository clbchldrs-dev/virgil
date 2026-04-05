import { tool } from "ai";
import { z } from "zod";
import { recordGoalCheckIn } from "@/lib/db/queries";
import { VirgilError } from "@/lib/errors";

export function checkInGoal({ userId }: { userId: string }) {
  return tool({
    description:
      "Record a check-in on one of the user's goals (updates streak and last touched). Use when they report progress on a stated goal.",
    inputSchema: z.object({
      goalId: z.string().uuid().describe("Goal id from listGoals"),
      notes: z.string().optional().describe("Optional short note"),
    }),
    execute: async (input) => {
      try {
        const { goal } = await recordGoalCheckIn({
          goalId: input.goalId,
          userId,
          notes: input.notes,
          source: "manual",
        });
        return {
          success: true as const,
          streakCurrent: goal.streakCurrent,
          streakBest: goal.streakBest,
          message: `Check-in recorded for "${goal.title}".`,
        };
      } catch (error) {
        if (error instanceof VirgilError) {
          return {
            success: false as const,
            message: error.message,
          };
        }
        return {
          success: false as const,
          message: "Could not record check-in.",
        };
      }
    },
  });
}
