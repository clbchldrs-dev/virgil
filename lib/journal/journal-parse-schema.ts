import { z } from "zod";

/** Structured extraction from a daily journal file (`generateObject`). */
export const journalParseOutputSchema = z.object({
  items: z
    .array(
      z.object({
        text: z
          .string()
          .describe(
            "One short standalone fact, goal, habit, or mood note from the entry"
          ),
      })
    )
    .min(1)
    .max(6),
});

export type JournalParseOutput = z.infer<typeof journalParseOutputSchema>;
