import { nanoid } from "nanoid";
import type { PolicyDecision } from "./policy-engine.js";
import type { DraftReply, InboundMessage } from "./schemas.js";

export type ReplyAgent = {
  draftReply: (input: {
    message: InboundMessage;
    policy: PolicyDecision;
  }) => DraftReply;
};

function buildTemplateReply(
  message: InboundMessage,
  policy: PolicyDecision
): string {
  const snippet = message.bodyText.trim().slice(0, 280);
  const modeLine = `Mode: ${policy.mode}; trust: ${policy.trustTier}; risk: ${policy.riskScore}.`;
  return [
    "Thanks — I saw your message.",
    snippet.length > 0 ? `Context: "${snippet}"` : "",
    modeLine,
    "If you need anything specific, tell me the next step you want.",
  ]
    .filter(Boolean)
    .join("\n");
}

export function createHeuristicReplyAgent(): ReplyAgent {
  return {
    draftReply: ({ message, policy }) => {
      const now = new Date().toISOString();
      return {
        id: nanoid(),
        inboundMessageId: message.externalMessageId,
        channel: message.channel,
        externalThreadId: message.externalThreadId,
        text: buildTemplateReply(message, policy),
        createdAt: now,
        policySnapshot: {
          route: policy.route,
          riskScore: policy.riskScore,
          reasons: policy.reasons,
          mode: policy.mode,
          trustTier: policy.trustTier,
        },
      };
    },
  };
}
