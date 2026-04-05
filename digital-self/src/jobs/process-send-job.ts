import type { OutboundMessage } from "../core/schemas.js";
import type { SendGateway } from "../core/send-gateway.js";

export type ProcessSendJob = {
  run: (message: OutboundMessage) => Promise<{ ok: true } | { ok: false }>;
};

export function createProcessSendJob(gateway: SendGateway): ProcessSendJob {
  return {
    run: (message) => gateway.sendWithRetry(message),
  };
}
