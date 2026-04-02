import { tool } from "ai";
import { z } from "zod";
import {
  countOpenClawBacklogForUser,
  queuePendingIntent,
  trySendPendingIntentById,
} from "@/lib/db/queries";
import {
  getCachedOpenClawSkillNames,
  pingOpenClaw,
} from "@/lib/integrations/openclaw-client";
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
    description:
      "Send a task to OpenClaw for execution. Use when the task involves messaging someone, running a shell command, file operations, or other actions Virgil cannot perform in-process. " +
      "Specify the OpenClaw skill name if known; otherwise describe the task and the best-matching skill is chosen from the live skill list (keyword overlap). " +
      "Destructive or outbound actions may require owner confirmation before sending.",
    inputSchema: z.object({
      description: z
        .string()
        .min(8)
        .describe("What should be done, in plain language"),
      skill: z
        .string()
        .optional()
        .describe("OpenClaw skill id when known, e.g. send-whatsapp"),
      params: z
        .record(z.string(), z.unknown())
        .optional()
        .describe("Skill-specific parameters when you know them"),
      urgent: z.boolean().optional().describe("When true, use high priority"),
    }),
    execute: async ({ description, skill, params, urgent }) => {
      const skills = await getCachedOpenClawSkillNames();
      const resolvedSkill =
        skill?.trim() ||
        matchSkillFromDescription(description, skills) ||
        "generic-task";
      const mergedParams: Record<string, unknown> = {
        ...(params ?? {}),
        description,
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

      const online = await pingOpenClaw();
      if (!online) {
        const backlog = await countOpenClawBacklogForUser(userId);
        return {
          ok: false,
          queued: true,
          intentId: row.id,
          message:
            `OpenClaw is unreachable. Intent queued (${String(backlog)} task(s) waiting). ` +
            "Approve in the app when OpenClaw is back, or retry later.",
        };
      }

      if (!needsConfirm) {
        const sendResult = await trySendPendingIntentById({
          id: row.id,
          userId,
        });
        if (sendResult.skipped) {
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
          "This action requires owner confirmation. Approve from notifications or use approveOpenClawIntent.",
      };
    },
  });
}
