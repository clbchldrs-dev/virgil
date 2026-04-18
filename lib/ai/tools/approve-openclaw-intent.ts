import { tool } from "ai";
import { z } from "zod";
import {
  confirmPendingIntent,
  countDelegationBacklogForUser,
  trySendPendingIntentById,
} from "@/lib/db/queries";
import {
  buildDelegationSendOutcome,
  buildDelegationSkipFailure,
} from "@/lib/integrations/delegation-errors";
import { buildApproveDelegationIntentToolDescription } from "@/lib/integrations/delegation-labels";
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
        const queuedBacklog =
          sendResult.reason === "backend_offline"
            ? await countDelegationBacklogForUser(userId)
            : 0;
        const failure = buildDelegationSkipFailure({
          reason: sendResult.reason,
          backend: delegationProvider.backend,
          queuedBacklog,
        });
        return {
          ...failure,
          intentId: id,
        };
      }
      return buildDelegationSendOutcome({
        backend: delegationProvider.backend,
        intentId: id,
        result: sendResult.result,
      });
    },
  });
}
