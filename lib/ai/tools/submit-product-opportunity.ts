import { tool } from "ai";
import { z } from "zod";
import { productOpportunityDeniedMessage } from "@/lib/ai/tool-policy";
import {
  anonymizedUserRef,
  createProductOpportunityIssue,
  sanitizeProductOpportunityToolError,
} from "@/lib/github/product-opportunity-issue";

/**
 * Gateway-only: files a GitHub Issue for human triage (local models omit this tool).
 * See docs/github-product-opportunity.md.
 */
export function submitProductOpportunity({
  userId,
  chatId,
  allowed,
}: {
  userId: string;
  chatId: string;
  /** False when local model, not configured, or route policy excludes this tool */
  allowed: boolean;
}) {
  return tool({
    description:
      "File a product improvement suggestion on the Virgil GitHub repo for the owner to triage. Use only after the user agrees or explicitly asks to send feedback. The idea must align with: helpful on local/small models, low recurring cost, and verifiable. Do not use for generic wishlists. If unsure, summarize in chat first and ask before calling.",
    inputSchema: z.object({
      title: z
        .string()
        .min(8)
        .max(120)
        .describe("Short issue title, actionable"),
      problem: z
        .string()
        .min(20)
        .describe("What is missing or painful in Virgil today?"),
      userEvidence: z
        .string()
        .min(10)
        .describe(
          "What the user said or did that supports this (paraphrase ok)"
        ),
      proposedSlice: z
        .string()
        .min(10)
        .describe("Smallest change that would help — one PR-sized slice"),
      nonGoals: z
        .string()
        .describe("Boundaries: what this suggestion is NOT asking for"),
      alignmentLocalFirst: z
        .boolean()
        .describe(
          "True if this primarily helps local / lightweight models, not only hosted giants"
        ),
      alignmentLowCost: z
        .boolean()
        .describe("True if this keeps or lowers recurring cost / infra"),
      alignmentTestable: z
        .string()
        .min(10)
        .describe("How to verify: tests, smoke steps, or manual QA"),
    }),
    needsApproval: true,
    execute: async (input) => {
      const policyMsg = productOpportunityDeniedMessage(allowed);
      if (policyMsg) {
        return { success: false as const, message: policyMsg };
      }

      try {
        const result = await createProductOpportunityIssue({
          title: input.title,
          problem: input.problem,
          userEvidence: input.userEvidence,
          proposedSlice: input.proposedSlice,
          nonGoals: input.nonGoals,
          alignmentLocalFirst: input.alignmentLocalFirst,
          alignmentLowCost: input.alignmentLowCost,
          alignmentTestable: input.alignmentTestable,
          chatId,
          userRef: anonymizedUserRef(userId),
        });
        return {
          success: true as const,
          issueNumber: result.number,
          url: result.htmlUrl,
          message: `Opened GitHub issue #${result.number}. The owner can triage and label approved-for-build when ready.`,
        };
      } catch (e) {
        return {
          success: false as const,
          message: sanitizeProductOpportunityToolError(e),
        };
      }
    },
  });
}
