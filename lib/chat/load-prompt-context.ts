import {
  getCapabilitiesForModel,
  type ModelCapabilities,
} from "@/lib/ai/models";
import {
  getMemoryPromptFetchLimit,
  getMemoryPromptSince,
} from "@/lib/chat/memory-prompt-config";
import { getRecentMemories } from "@/lib/db/queries";
import type { Memory } from "@/lib/db/schema";

export type ChatPromptContextLoad = {
  capabilities: ModelCapabilities;
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
  const [capabilities, recentMemories] = await Promise.all([
    getCapabilitiesForModel(chatModel),
    getRecentMemories({
      userId,
      since: getMemoryPromptSince(),
      limit: getMemoryPromptFetchLimit(),
    }),
  ]);

  return {
    capabilities,
    recentMemories,
  };
}
