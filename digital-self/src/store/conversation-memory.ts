import type { InterferenceMode, TrustTier } from "../core/schemas.js";

export type ConversationProfile = {
  externalThreadId: string;
  trustTier: TrustTier;
  mode: InterferenceMode | undefined;
  lastInboundAt: string;
};

export type ConversationMemoryStore = {
  getProfile: (externalThreadId: string) => ConversationProfile | undefined;
  upsertFromInbound: (input: {
    externalThreadId: string;
    receivedAt: string;
    trustTier?: TrustTier;
    mode?: InterferenceMode;
  }) => ConversationProfile;
};

export function createInMemoryConversationStore(): ConversationMemoryStore {
  const map = new Map<string, ConversationProfile>();

  return {
    getProfile: (externalThreadId) => map.get(externalThreadId),
    upsertFromInbound: ({ externalThreadId, receivedAt, trustTier, mode }) => {
      const existing = map.get(externalThreadId);
      const profile: ConversationProfile = {
        externalThreadId,
        trustTier: trustTier ?? existing?.trustTier ?? "unknown",
        mode: mode ?? existing?.mode,
        lastInboundAt: receivedAt,
      };
      map.set(externalThreadId, profile);
      return profile;
    },
  };
}
