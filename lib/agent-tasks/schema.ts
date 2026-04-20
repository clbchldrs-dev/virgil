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
    .enum(["well_aligned", "needs_discussion", "principle_conflict"])
    .describe(
      "Alignment signal only — NOT AgentTask workflow status. well_aligned = fits principles; needs_discussion = unclear; principle_conflict = likely misaligned with AGENTS.md. Owner always approves/rejects tasks separately."
    ),
  summary: z
    .string()
    .describe(
      "One-paragraph triage summary: what the task does, scope estimate, and recommendation rationale"
    ),
});

export type AgentTaskTriageOutput = z.infer<typeof agentTaskTriageOutputSchema>;
