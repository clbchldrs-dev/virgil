import { nanoid } from "nanoid";

export type AuditEventType =
  | "inbound.received"
  | "policy.decision"
  | "draft.created"
  | "approval.created"
  | "approval.resolved"
  | "outbound.send.attempt"
  | "outbound.send.success"
  | "outbound.send.failure"
  | "dlq.enqueued"
  | "webhook.received"
  | "replay.replayed";

export type AuditEvent = {
  id: string;
  type: AuditEventType;
  createdAt: string;
  payload: Record<string, unknown>;
};

export type AuditStore = {
  append: (input: {
    type: AuditEventType;
    payload: Record<string, unknown>;
  }) => AuditEvent;
  list: (limit?: number) => AuditEvent[];
};

export function createInMemoryAuditStore(): AuditStore {
  const events: AuditEvent[] = [];

  return {
    append: ({ type, payload }) => {
      const event: AuditEvent = {
        id: nanoid(),
        type,
        createdAt: new Date().toISOString(),
        payload,
      };
      events.push(event);
      return event;
    },
    list: (limit = 100) => events.slice(-limit),
  };
}
