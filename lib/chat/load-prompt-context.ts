import {
  getCapabilitiesForModel,
  type ModelCapabilities,
} from "@/lib/ai/models";
import {
  getMemoryPromptFetchLimit,
  getMemoryPromptSince,
} from "@/lib/chat/memory-prompt-config";
import { getRecentMemories, listActiveGoalsForUser } from "@/lib/db/queries";
import type { Goal, Memory } from "@/lib/db/schema";
import { agentIngestLogSession308ef5 } from "@/lib/debug/agent-ingest-log";

export type ChatPromptContextLoad = {
  capabilities: ModelCapabilities;
  recentMemories: Memory[];
  activeGoals: Goal[];
};

/**
 * Parallel DB + capability fetch for chat system prompt (reduces sequential latency).
 */
function rejectionMessage(reason: unknown): string {
  if (reason instanceof Error) {
    return reason.message;
  }
  return String(reason);
}

export async function loadChatPromptContext({
  userId,
  chatModel,
}: {
  userId: string;
  chatModel: string;
}): Promise<ChatPromptContextLoad> {
  const capabilities = await getCapabilitiesForModel(chatModel);

  const [memoriesOutcome, goalsOutcome] = await Promise.allSettled([
    getRecentMemories({
      userId,
      since: getMemoryPromptSince(),
      limit: getMemoryPromptFetchLimit(),
    }),
    listActiveGoalsForUser({ userId, limit: 12 }),
  ]);

  let recentMemories: Memory[] = [];
  if (memoriesOutcome.status === "fulfilled") {
    recentMemories = memoriesOutcome.value;
  } else {
    agentIngestLogSession308ef5({
      hypothesisId: "prompt-ctx-memories",
      location: "load-prompt-context.ts:getRecentMemories",
      message: "getRecentMemories rejected",
      data: {
        errorMessage: rejectionMessage(memoriesOutcome.reason).slice(0, 500),
      },
    });
  }

  let activeGoals: Goal[] = [];
  if (goalsOutcome.status === "fulfilled") {
    activeGoals = goalsOutcome.value;
  } else {
    agentIngestLogSession308ef5({
      hypothesisId: "prompt-ctx-goals",
      location: "load-prompt-context.ts:listActiveGoalsForUser",
      message: "listActiveGoalsForUser rejected",
      data: {
        errorMessage: rejectionMessage(goalsOutcome.reason).slice(0, 500),
      },
    });
  }

  return {
    capabilities,
    recentMemories,
    activeGoals,
  };
}
