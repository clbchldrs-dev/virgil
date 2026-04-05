import type { Channel } from "../core/schemas.js";
import { createSlackAdapter } from "./slack.js";
import { createSmsAdapter } from "./sms.js";
import type { AdapterRegistry, ChannelAdapter } from "./types.js";
import { createWhatsAppAdapter } from "./whatsapp.js";

export type AdapterOverrides = Partial<{
  slack: ChannelAdapter;
  whatsapp: ChannelAdapter;
  sms: ChannelAdapter;
}>;

export function createAdapterRegistry(
  overrides?: AdapterOverrides
): AdapterRegistry {
  const slack = overrides?.slack ?? createSlackAdapter({});
  const whatsapp = overrides?.whatsapp ?? createWhatsAppAdapter({});
  const sms = overrides?.sms ?? createSmsAdapter({});

  const map: Record<Channel, ChannelAdapter> = {
    slack,
    whatsapp,
    sms,
  };

  return {
    get: (channel) => map[channel],
  };
}
