import type { DigitalSelfEnv } from "../config.js";
import type { ProcessSendJob } from "../jobs/process-send-job.js";
import { notifyVirgilApprovalQueued } from "../lib/virgil-bridge.js";
import type { ApprovalStore } from "../store/approval-store.js";
import type { AuditStore } from "../store/audit-store.js";
import type { ConversationMemoryStore } from "../store/conversation-memory.js";
import type { MetricsStore } from "../store/metrics-store.js";
import { classifyInboundIntent } from "./intent-classifier.js";
import { evaluatePolicy } from "./policy-engine.js";
import { createHeuristicReplyAgent } from "./reply-agent.js";
import type { IngestRequest } from "./schemas.js";
import { buildOutboundFromDraft } from "./send-gateway.js";

export type Orchestrator = {
  ingest: (input: IngestRequest) => Promise<{
    status: "ingested";
    route: string;
    approvalId?: string;
    outboundId?: string;
  }>;
};

export function createOrchestrator(input: {
  env: DigitalSelfEnv;
  conversation: ConversationMemoryStore;
  approvals: ApprovalStore;
  audit: AuditStore;
  metrics: MetricsStore;
  sendJob: ProcessSendJob;
}): Orchestrator {
  const replyAgent = createHeuristicReplyAgent();

  return {
    ingest: async (body) => {
      input.metrics.increment("ingestCount");
      const message = body.message;
      const profile = input.conversation.upsertFromInbound({
        externalThreadId: message.externalThreadId,
        receivedAt: message.receivedAt,
        ...(body.ownerTrustTier === undefined
          ? {}
          : { trustTier: body.ownerTrustTier }),
        ...(body.mode === undefined ? {} : { mode: body.mode }),
      });

      const intent = classifyInboundIntent(message);
      const policy = evaluatePolicy({
        message,
        trustTier: profile.trustTier,
        mode: body.mode,
        storedMode: profile.mode,
      });

      input.audit.append({
        type: "inbound.received",
        payload: {
          channel: message.channel,
          threadId: message.externalThreadId,
          messageId: message.externalMessageId,
        },
      });
      input.audit.append({
        type: "policy.decision",
        payload: {
          route: policy.route,
          riskScore: policy.riskScore,
          reasons: policy.reasons,
          mode: policy.mode,
          trustTier: policy.trustTier,
          intent: intent.intent,
          intentNotes: intent.notes,
        },
      });

      if (policy.route === "block") {
        input.metrics.increment("blockedCount");
        return { status: "ingested", route: "block" };
      }

      if (policy.route === "hold") {
        input.metrics.increment("heldCount");
        return { status: "ingested", route: "hold" };
      }

      const draft = replyAgent.draftReply({ message, policy });
      input.audit.append({
        type: "draft.created",
        payload: { draftId: draft.id, channel: draft.channel },
      });

      if (policy.route === "approval") {
        const pending = input.approvals.createPending(draft);
        input.metrics.increment("approvalQueuedCount");
        input.audit.append({
          type: "approval.created",
          payload: { approvalId: pending.id, draftId: draft.id },
        });
        await notifyVirgilApprovalQueued({ env: input.env, approval: pending });
        return {
          status: "ingested",
          route: "approval",
          approvalId: pending.id,
        };
      }

      input.metrics.increment("autoSendCount");
      const outbound = buildOutboundFromDraft({
        draftText: draft.text,
        channel: draft.channel,
        externalThreadId: draft.externalThreadId,
        idempotencyKey: `${message.externalMessageId}:${draft.id}`,
      });
      await input.sendJob.run(outbound);
      return {
        status: "ingested",
        route: "auto",
        outboundId: outbound.id,
      };
    },
  };
}
