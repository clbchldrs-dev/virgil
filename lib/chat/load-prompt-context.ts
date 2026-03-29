import {
  getCapabilitiesForModel,
  type ModelCapabilities,
} from "@/lib/ai/models";
import {
  getBusinessProfileByUserId,
  getPriorityNotes,
  getRecentMemories,
} from "@/lib/db/queries";
import type { BusinessProfile, Memory, PriorityNote } from "@/lib/db/schema";

export type ChatPromptContextLoad = {
  capabilities: ModelCapabilities;
  businessProfile: BusinessProfile | null;
  priorityNotes: PriorityNote[];
  recentMemories: Memory[];
};

/**
 * Parallel DB + capability fetch for chat system prompt (reduces sequential latency).
 */
export async function loadChatPromptContext({
  userId,
  chatModel,
}: {
  userId: string;
  chatModel: string;
}): Promise<ChatPromptContextLoad> {
  const [capabilities, businessProfile, recentMemories] = await Promise.all([
    getCapabilitiesForModel(chatModel),
    getBusinessProfileByUserId({ userId }),
    getRecentMemories({
      userId,
      since: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
      limit: 15,
    }),
  ]);

  const priorityNotes = businessProfile
    ? await getPriorityNotes({
        businessProfileId: businessProfile.id,
      })
    : [];

  return {
    capabilities,
    businessProfile,
    priorityNotes,
    recentMemories,
  };
}
