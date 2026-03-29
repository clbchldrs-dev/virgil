import { tool } from "ai";
import { z } from "zod";

export const summarizeOpportunity = tool({
  description:
    "Summarize a business opportunity or lead from the conversation. Use when the customer expresses interest in a service, asks about pricing, or indicates they want to proceed.",
  inputSchema: z.object({
    customerName: z.string().optional().describe("Customer's name if known"),
    serviceInterest: z
      .string()
      .describe("Which service or product the customer is interested in"),
    timeline: z
      .string()
      .optional()
      .describe("When the customer needs the service"),
    estimatedValue: z
      .string()
      .optional()
      .describe("Rough estimate of the opportunity value if determinable"),
    nextStep: z.string().describe("Recommended next action for the business"),
  }),
  execute: (input) => {
    return {
      type: "opportunity",
      ...input,
      capturedAt: new Date().toISOString(),
    };
  },
});
