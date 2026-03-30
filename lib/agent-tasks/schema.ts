import { z } from "zod";

export const agentTaskTriageOutputSchema = z.object({
  alignsWithPrinciples: z
    .boolean()
    .describe(
      "Does this task align with AGENTS.md principles? (local-first, low cost, focused)"
    ),
  alignmentNotes: z
    .string()
    .describe(
      "Brief explanation of how the task aligns or conflicts with project principles"
    ),
  estimatedScope: z
    .enum(["small", "medium", "large"])
    .describe(
      "How large is this task? small = single file, medium = 2-5 files, large = broad changes"
    ),
  suggestedFiles: z
    .array(z.string())
    .default([])
    .describe("File paths likely relevant to implementing this task"),
  riskNotes: z
    .string()
    .optional()
    .describe("Any risks, breaking changes, or concerns with this task"),
  recommendation: z
    .enum(["approve", "needs_discussion", "reject"])
    .describe(
      "Triage recommendation: approve for straightforward tasks, needs_discussion for ambiguous, reject for misaligned"
    ),
  summary: z
    .string()
    .describe(
      "One-paragraph triage summary: what the task does, scope estimate, and recommendation rationale"
    ),
});

export type AgentTaskTriageOutput = z.infer<typeof agentTaskTriageOutputSchema>;
