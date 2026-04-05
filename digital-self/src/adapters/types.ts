import type { Channel, OutboundMessage } from "../core/schemas.js";

export type SendResult =
  | { ok: true; providerMessageId?: string }
  | { ok: false; error: string };

export type ChannelAdapter = {
  channel: Channel;
  send: (message: OutboundMessage) => Promise<SendResult>;
};

export type AdapterRegistry = {
  get: (channel: Channel) => ChannelAdapter;
};
