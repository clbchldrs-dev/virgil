import { nanoid } from "nanoid";
import type { AdapterRegistry } from "../adapters/types.js";
import type { AuditStore } from "../store/audit-store.js";
import type { DeadLetterStore } from "../store/dlq-store.js";
import type { MetricsStore } from "../store/metrics-store.js";
import type { OutboundMessage } from "./schemas.js";

const MAX_ATTEMPTS = 3;

export type SendGateway = {
  sendWithRetry: (
    message: OutboundMessage
  ) => Promise<{ ok: true } | { ok: false }>;
};

export function createSendGateway(input: {
  adapters: AdapterRegistry;
  audit: AuditStore;
  dlq: DeadLetterStore;
  metrics: MetricsStore;
}): SendGateway {
  return {
    sendWithRetry: async (message) => {
      const adapter = input.adapters.get(message.channel);
      let attempts = 0;
      let lastError = "unknown";

      while (attempts < MAX_ATTEMPTS) {
        attempts += 1;
        input.audit.append({
          type: "outbound.send.attempt",
          payload: {
            outboundId: message.id,
            channel: message.channel,
            attempt: attempts,
            idempotencyKey: message.idempotencyKey,
          },
        });

        const result = await adapter.send(message);
        if (result.ok) {
          input.metrics.increment("outboundSuccess");
          input.audit.append({
            type: "outbound.send.success",
            payload: {
              outboundId: message.id,
              channel: message.channel,
              providerMessageId: result.providerMessageId,
              attempts,
            },
          });
          return { ok: true };
        }

        lastError = result.error;
      }

      input.metrics.increment("outboundFailure");
      input.metrics.increment("dlqCount");
      input.audit.append({
        type: "outbound.send.failure",
        payload: {
          outboundId: message.id,
          channel: message.channel,
          error: lastError,
          attempts,
        },
      });
      input.dlq.enqueue({
        message,
        error: lastError,
        attempts,
      });
      input.audit.append({
        type: "dlq.enqueued",
        payload: {
          outboundId: message.id,
          channel: message.channel,
          error: lastError,
        },
      });
      return { ok: false };
    },
  };
}

export function buildOutboundFromDraft(input: {
  draftText: string;
  channel: OutboundMessage["channel"];
  externalThreadId: string;
  sourceApprovalId?: string;
  idempotencyKey?: string;
}): OutboundMessage {
  const now = new Date().toISOString();
  return {
    id: nanoid(),
    channel: input.channel,
    externalThreadId: input.externalThreadId,
    text: input.draftText,
    idempotencyKey: input.idempotencyKey ?? nanoid(),
    sourceApprovalId: input.sourceApprovalId,
    createdAt: now,
  };
}
