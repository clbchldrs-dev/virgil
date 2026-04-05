import { tool } from "ai";
import { z } from "zod";
import { listActiveGoalsForUser } from "@/lib/db/queries";

export function listGoals({ userId }: { userId: string }) {
  return tool({
    description:
      "List the user's active structured goals (cadence, streaks). Use when discussing priorities, weekly reviews, or accountability.",
    inputSchema: z.object({}),
    execute: async () => {
      const goals = await listActiveGoalsForUser({ userId, limit: 20 });
      return {
        count: goals.length,
        goals: goals.map((g) => ({
          id: g.id,
          title: g.title,
          category: g.category,
          description: g.description,
          targetCadence: g.targetCadence,
          status: g.status,
          streakCurrent: g.streakCurrent,
          streakBest: g.streakBest,
          blockers: g.blockers,
          lastTouchedAt: g.lastTouchedAt.toISOString(),
        })),
      };
    },
  });
}
