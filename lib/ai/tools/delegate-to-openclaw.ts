import { tool } from "ai";
import { delegateTaskInputSchema } from "@/lib/ai/tools/delegate-task-input-schema";
import {
  countDelegationBacklogForUser,
  queuePendingIntent,
  trySendPendingIntentById,
} from "@/lib/db/queries";
import {
  buildDelegationQueuedSuccess,
  buildDelegationSendOutcome,
  buildDelegationSkipFailure,
} from "@/lib/integrations/delegation-errors";
import {
  buildDelegateTaskToolDescription,
  delegationUnknownSkillMessage,
} from "@/lib/integrations/delegation-labels";
import {
  delegationListSkillNamesUnion,
  delegationPing,
  getDelegationProvider,
} from "@/lib/integrations/delegation-provider";
import { isDelegationStrictSkillAllowlist } from "@/lib/integrations/delegation-skill-policy";
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
    inputSchema: delegateTaskInputSchema,
    execute: async ({ description, lane, skill, params, urgent }) => {
      try {
        const delegationProvider = getDelegationProvider();
        const backend = delegationProvider.backend;
        const skillTrimmed = skill?.trim();
        const strict = isDelegationStrictSkillAllowlist();

        // Only enumerate skills when we actually need to (strict allowlist, or
        // the caller didn't provide a skill and we need to infer one). In the
        // default (non-strict) path with a provided skill, we skip the extra
        // HTTP round-trip entirely — the gateway decides what's valid.
        const shouldListSkills = strict || !skillTrimmed;
        const skills = shouldListSkills
          ? await delegationListSkillNamesUnion()
          : [];

        if (
          strict &&
          skillTrimmed &&
          skills.length > 0 &&
          !skills.includes(skillTrimmed)
        ) {
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

        const online = await delegationPing();
        if (!online) {
          const backlog = await countDelegationBacklogForUser(userId);
          const failure = buildDelegationSkipFailure({
            reason: "backend_offline",
            backend,
            queuedBacklog: backlog,
          });
          return {
            ...failure,
            intentId: row.id,
          };
        }

        if (!needsConfirm) {
          const sendResult = await trySendPendingIntentById({
            id: row.id,
            userId,
          });
          if (sendResult.skipped) {
            const backlog =
              sendResult.reason === "backend_offline"
                ? await countDelegationBacklogForUser(userId)
                : 0;
            const failure = buildDelegationSkipFailure({
              reason: sendResult.reason,
              backend,
              queuedBacklog: backlog,
            });
            return {
              ...failure,
              intentId: row.id,
            };
          }
          return buildDelegationSendOutcome({
            backend,
            intentId: row.id,
            result: sendResult.result,
          });
        }

        return buildDelegationQueuedSuccess({
          backend,
          intentId: row.id,
          message:
            "This action requires owner confirmation. Approve from notifications or use approveDelegationIntent (or approveOpenClawIntent).",
        });
      } catch (err) {
        const msg =
          err instanceof Error
            ? err.message
            : "Unknown error queuing delegation.";
        return {
          ok: false,
          queued: false,
          message: msg,
        };
      }
    },
  });
}
