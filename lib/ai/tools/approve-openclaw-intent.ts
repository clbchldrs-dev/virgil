import { tool } from "ai";
import { z } from "zod";
import {
  confirmPendingIntent,
  trySendPendingIntentById,
} from "@/lib/db/queries";
import { buildApproveDelegationIntentToolDescription } from "@/lib/integrations/delegation-labels";

export function approveOpenClawIntent({ userId }: { userId: string }) {
  return tool({
    description: buildApproveDelegationIntentToolDescription(),
    inputSchema: z.object({
      id: z
        .string()
        .uuid()
        .describe("Pending intent id returned by delegateTask"),
    }),
    execute: async ({ id }) => {
      const confirmed = await confirmPendingIntent({ id, userId });
      if (!confirmed) {
        return {
          ok: false,
          message:
            "No matching pending intent to confirm (wrong id, already handled, or confirmation not required).",
        };
      }
      const sendResult = await trySendPendingIntentById({ id, userId });
      if (sendResult.skipped) {
        return {
          ok: false,
          intentId: id,
          message: "Intent could not be sent after confirmation.",
        };
      }
      return {
        ok: sendResult.result.success,
        intentId: id,
        output: sendResult.result.output,
        error: sendResult.result.error,
      };
    },
  });
}
