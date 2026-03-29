import { tool } from "ai";
import { z } from "zod";
import { saveIntakeSubmission } from "@/lib/db/queries";

export function recordIntake({
  businessProfileId,
  chatId,
}: {
  businessProfileId: string;
  chatId: string;
}) {
  return tool({
    description:
      "Record a new customer intake. Call this when a customer provides their contact info, describes their need, or wants to be followed up with.",
    inputSchema: z.object({
      customerName: z.string().optional().describe("Customer's full name"),
      customerEmail: z.string().email().optional().describe("Customer email"),
      customerPhone: z.string().optional().describe("Customer phone number"),
      need: z.string().describe("Brief description of what the customer needs"),
      urgency: z
        .enum(["low", "medium", "high"])
        .default("medium")
        .describe("How urgent the request is"),
      channelPreference: z
        .enum(["email", "phone", "text", "chat"])
        .optional()
        .describe("How the customer prefers to be contacted"),
      notes: z.string().optional().describe("Any additional context or notes"),
    }),
    needsApproval: true,
    execute: async (input) => {
      const submission = await saveIntakeSubmission({
        businessProfileId,
        chatId,
        ...input,
      });

      return {
        success: true,
        submissionId: submission.id,
        message: `Intake recorded for ${input.customerName ?? "customer"}. The business will follow up via ${input.channelPreference ?? "their preferred method"}.`,
      };
    },
  });
}
