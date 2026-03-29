import { tool } from "ai";
import { z } from "zod";
import { saveEscalationRecord } from "@/lib/db/queries";

export function escalateToHuman({
  businessProfileId,
  chatId,
  businessName,
}: {
  businessProfileId: string;
  chatId: string;
  businessName: string;
}) {
  return tool({
    description:
      "Escalate to a human when you cannot confidently answer, the customer explicitly asks for a person, or the situation matches escalation rules. Always collect context first.",
    inputSchema: z.object({
      customerName: z.string().optional().describe("Customer's name if known"),
      summary: z
        .string()
        .describe(
          "Summary of the issue and why escalation is needed, including any info gathered"
        ),
      urgency: z
        .enum(["low", "medium", "high"])
        .default("medium")
        .describe("How urgent this escalation is"),
    }),
    execute: async (input) => {
      const record = await saveEscalationRecord({
        businessProfileId,
        chatId,
        ...input,
      });

      return {
        success: true,
        escalationId: record.id,
        replyToCustomer: `I've noted your request — someone from ${businessName} will follow up shortly. Your reference number is ${record.id.slice(0, 8).toUpperCase()}.`,
      };
    },
  });
}
