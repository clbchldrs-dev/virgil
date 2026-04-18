import { tool } from "ai";
import { z } from "zod";
import {
  confirmPendingIntent,
  countDelegationBacklogForUser,
  trySendPendingIntentById,
} from "@/lib/db/queries";
import {
  buildApproveDelegationIntentToolDescription,
  delegationUnreachableMessage,
} from "@/lib/integrations/delegation-labels";
import { getDelegationProvider } from "@/lib/integrations/delegation-provider";

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
      const delegationProvider = getDelegationProvider();
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
        if (sendResult.reason === "backend_offline") {
          const backlog = await countDelegationBacklogForUser(userId);
          return {
            ok: false,
            intentId: id,
            message: delegationUnreachableMessage(
              delegationProvider.backend,
              backlog
            ),
          };
        }
        return {
          ok: false,
          intentId: id,
          message: `Intent could not be sent after confirmation (${sendResult.reason}).`,
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
