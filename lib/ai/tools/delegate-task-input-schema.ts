import { z } from "zod";
import { virgilLaneIdSchema } from "@/lib/ai/lanes";

/**
 * Zod input for `delegateTask` — lives in a tiny module so unit tests do not
 * import `delegate-to-openclaw.ts` (that graph pulls `server-only` / DB).
 */
export const delegateTaskInputSchema = z.object({
  description: z
    .string()
    .min(8)
    .describe("What should be done, in plain language"),
  lane: virgilLaneIdSchema
    .nullish()
    .describe(
      "Delegation lane: use **home** for LAN/out-of-app execution (default); **chat**/**code**/**research** if tagging a mixed flow for logging"
    ),
  skill: z
    .string()
    .nullish()
    .describe(
      "Gateway/delegation skill id when known (e.g. openclaw, generic-task, send-whatsapp). Omit or null to infer from description."
    ),
  params: z
    .record(z.string(), z.unknown())
    .nullish()
    .describe("Skill-specific parameters when you know them"),
  urgent: z.boolean().nullish().describe("When true, use high priority"),
});
