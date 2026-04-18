import { tool } from "ai";
import { z } from "zod";
import { virgilLaneIdSchema } from "@/lib/ai/lanes";
import {
  countDelegationBacklogForUser,
  queuePendingIntent,
  trySendPendingIntentById,
} from "@/lib/db/queries";
import {
  buildDelegateTaskToolDescription,
  delegationUnknownSkillMessage,
  delegationUnreachableMessage,
} from "@/lib/integrations/delegation-labels";
import { getDelegationProvider } from "@/lib/integrations/delegation-provider";
import {
  delegationNeedsConfirmation,
  matchSkillFromDescription,
} from "@/lib/integrations/openclaw-match";
import type { ClawIntent } from "@/lib/integrations/openclaw-types";

export function delegateTaskToOpenClaw({
  userId,
  chatId,
}: {
  userId: string;
  chatId: string;
}) {
  return tool({
    description: buildDelegateTaskToolDescription(),
    inputSchema: z.object({
      description: z
        .string()
        .min(8)
        .describe("What should be done, in plain language"),
      lane: virgilLaneIdSchema
        .optional()
        .describe(
          "Delegation lane: use **home** for LAN/out-of-app execution (default); **chat**/**code**/**research** if tagging a mixed flow for logging"
        ),
      skill: z
        .string()
        .optional()
        .describe(
          "Known delegation skill id when available, e.g. send-whatsapp"
        ),
      params: z
        .record(z.string(), z.unknown())
        .optional()
        .describe("Skill-specific parameters when you know them"),
      urgent: z.boolean().optional().describe("When true, use high priority"),
    }),
    execute: async ({ description, lane, skill, params, urgent }) => {
      const delegationProvider = getDelegationProvider();
      const backend = delegationProvider.backend;
      const skills = await delegationProvider.listSkillNames();
      const skillTrimmed = skill?.trim();
      if (skillTrimmed && skills.length > 0 && !skills.includes(skillTrimmed)) {
        const sample = skills.slice(0, 24).join(", ");
        const suffix = skills.length > 24 ? ", …" : "";
        return {
          ok: false,
          queued: false,
          message: delegationUnknownSkillMessage(
            backend,
            skillTrimmed,
            sample,
            suffix
          ),
        };
      }
      const resolvedSkill =
        skillTrimmed ||
        matchSkillFromDescription(description, skills) ||
        "generic-task";
      const resolvedLane = lane ?? "home";
      const mergedParams: Record<string, unknown> = {
        ...(params ?? {}),
        description,
        virgilLane: resolvedLane,
      };
      const explicitDestructive =
        params !== undefined &&
        typeof params === "object" &&
        params !== null &&
        "destructive" in params &&
        Boolean((params as { destructive?: unknown }).destructive);
      const needsConfirm =
        delegationNeedsConfirmation(description, resolvedSkill) ||
        explicitDestructive;

      const intent: ClawIntent = {
        skill: resolvedSkill,
        params: mergedParams,
        priority: urgent ? "high" : "normal",
        source: "chat",
        requiresConfirmation: needsConfirm,
      };

      const row = await queuePendingIntent({
        userId,
        chatId,
        intent,
        skill: resolvedSkill,
        requiresConfirmation: needsConfirm,
      });

      const online = await delegationProvider.ping();
      if (!online) {
        const backlog = await countDelegationBacklogForUser(userId);
        return {
          ok: false,
          queued: true,
          intentId: row.id,
          message: delegationUnreachableMessage(backend, backlog),
        };
      }

      if (!needsConfirm) {
        const sendResult = await trySendPendingIntentById({
          id: row.id,
          userId,
        });
        if (sendResult.skipped) {
          if (sendResult.reason === "backend_offline") {
            const backlog = await countDelegationBacklogForUser(userId);
            return {
              ok: false,
              queued: true,
              intentId: row.id,
              message:
                `Delegation backend is offline. Intent queued (${String(backlog)} task(s) waiting). ` +
                "Retry later or approve/send when the backend is reachable.",
            };
          }
          return {
            ok: false,
            intentId: row.id,
            message: "Could not send intent (unexpected state).",
          };
        }
        return {
          ok: sendResult.result.success,
          intentId: row.id,
          output: sendResult.result.output,
          error: sendResult.result.error,
        };
      }

      return {
        ok: true,
        queued: true,
        intentId: row.id,
        message:
          "This action requires owner confirmation. Approve from notifications or use approveDelegationIntent (or approveOpenClawIntent).",
      };
    },
  });
}
