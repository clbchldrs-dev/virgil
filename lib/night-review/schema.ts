import { z } from "zod";

/** Structured output from the night-review model (AI SDK generateObject). */
export const nightReviewOutputSchema = z.object({
  status: z
    .enum(["ok", "findings"])
    .describe(
      "ok = nothing material (like HEARTBEAT_OK); findings = there are patterns, gaps, or suggestions to persist"
    ),
  summary: z
    .string()
    .optional()
    .describe("One short paragraph if status is findings"),
  patterns: z
    .array(
      z.object({
        description: z.string(),
        evidence: z.string().optional(),
      })
    )
    .default([]),
  toolGaps: z
    .array(
      z.object({
        description: z.string(),
        suggestedSkill: z.string().optional(),
      })
    )
    .default([]),
  suggestedMemories: z
    .array(
      z.object({
        kind: z.enum(["note", "opportunity", "goal", "fact"]),
        content: z.string(),
      })
    )
    .default([]),
  improvements: z.array(z.string()).default([]),
});

export type NightReviewOutput = z.infer<typeof nightReviewOutputSchema>;
