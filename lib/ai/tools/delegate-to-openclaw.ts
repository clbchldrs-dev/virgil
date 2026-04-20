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
import { evaluateDelegationPreflight } from "@/lib/integrations/delegation-preflight";
import {
  delegationListSkillDescriptorsUnion,
  delegationListSkillNamesUnion,
  delegationPing,
  getDelegationProvider,
} from "@/lib/integrations/delegation-provider";
import { evaluateDelegationReadiness } from "@/lib/integrations/delegation-readiness";
import { resolveDelegationSkill } from "@/lib/integrations/delegation-routing";
import { isDelegationStrictSkillAllowlist } from "@/lib/integrations/delegation-skill-policy";
import { delegationNeedsConfirmation } from "@/lib/integrations/openclaw-match";
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
        const skillDescriptors = shouldListSkills
          ? await delegationListSkillDescriptorsUnion()
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
            error: "delegation_preflight_failed",
            reason: "preflight_failed",
            retryable: false,
            backend,
            errorCode: "provided_skill_not_advertised",
            message: delegationUnknownSkillMessage(
              backend,
              skillTrimmed,
              sample,
              suffix
            ),
          };
        }
        const resolvedLane = lane ?? "home";
        const routing = resolveDelegationSkill({
          description,
          providedSkill: skillTrimmed ?? undefined,
          lane: resolvedLane,
          advertisedSkills: skills,
        });
        const resolvedSkill = routing.resolvedSkill;
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

        const online = await delegationPing();
        const readiness = evaluateDelegationReadiness({
          online,
          providedSkill: skillTrimmed,
          resolvedSkill,
          skillDescriptors,
        });
        const preflight = evaluateDelegationPreflight({
          readiness,
          advertisedSkillCount: skillDescriptors.length,
        });
        if (!preflight.ok) {
          return {
            ok: false,
            queued: false,
            error: "delegation_preflight_failed",
            reason: preflight.reason,
            retryable: false,
            backend,
            errorCode: preflight.reason,
            message: preflight.message,
            readiness,
            trace: { routing, preflight },
          };
        }
        const row = await queuePendingIntent({
          userId,
          chatId,
          intent,
          skill: resolvedSkill,
          requiresConfirmation: needsConfirm,
        });
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
            readiness,
            trace: { routing, preflight },
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
              readiness,
              trace: { routing, preflight },
            };
          }
          return {
            ...buildDelegationSendOutcome({
              backend,
              intentId: row.id,
              result: sendResult.result,
            }),
            readiness,
            trace: { routing, preflight },
          };
        }

        return {
          ...buildDelegationQueuedSuccess({
            backend,
            intentId: row.id,
            message:
              "This action requires owner confirmation. Approve from notifications or use approveDelegationIntent (or approveOpenClawIntent).",
          }),
          readiness,
          trace: { routing, preflight },
        };
      } catch (err) {
        const msg =
          err instanceof Error
            ? err.message
            : "Unknown error queuing delegation.";
        return {
          ok: false,
          queued: false,
          error: "delegation_execution_failed",
          reason: "execution_failed",
          retryable: false,
          backend: getDelegationProvider().backend,
          errorCode: "tool_runtime_error",
          message: msg,
        };
      }
    },
  });
}
