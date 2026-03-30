import { tool } from "ai";
import { z } from "zod";

export const getBriefing = tool({
  description:
    "Generate a situational briefing for the start of a new session. Call this at the beginning of a new conversation to establish context about the current day, schedule, and active work.",
  inputSchema: z.object({}),
  execute: async () => {
    const fs = await import("node:fs");
    const path = await import("node:path");

    const now = new Date();
    const dayOfWeek = now.toLocaleDateString("en-US", { weekday: "long" });
    const dateStr = now.toLocaleDateString("en-US", {
      month: "long",
      day: "numeric",
      year: "numeric",
    });
    const timeStr = now.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
    });

    let userContext = "(No user context file found.)";
    try {
      const contextPath =
        process.env.USER_CONTEXT_PATH ??
        path.join(process.cwd(), "user-context.md");
      userContext = fs.readFileSync(contextPath, "utf-8");
    } catch {
      // Context file missing — briefing still works with time info
    }

    return {
      timestamp: now.toISOString(),
      day: dayOfWeek,
      date: dateStr,
      time: timeStr,
      userContext,
    };
  },
});
