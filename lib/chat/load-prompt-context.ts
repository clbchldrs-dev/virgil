import {
  getCapabilitiesForModel,
  type ModelCapabilities,
} from "@/lib/ai/models";
import {
  getMemoryPromptFetchLimit,
  getMemoryPromptSince,
} from "@/lib/chat/memory-prompt-config";
import {
  getRecentMemories,
  listActiveGoalsForUser,
  listDayTasksForUser,
  listHealthSnapshotsForUser,
} from "@/lib/db/queries";
import type { DayTask, Goal, HealthSnapshot, Memory } from "@/lib/db/schema";
import {
  computeWindowKey,
  getNightReviewTimezone,
} from "@/lib/night-review/config";
import { agentIngestLogSession308ef5 } from "@/lib/debug/agent-ingest-log";

export type ChatPromptContextLoad = {
  capabilities: ModelCapabilities;
  recentMemories: Memory[];
  activeGoals: Goal[];
  /** Today's day-list tasks in owner TZ (`NIGHT_REVIEW_TIMEZONE`). */
  dayTasksToday: DayTask[];
  /** YYYY-MM-DD key matching {@link dayTasksToday}. */
  dayTaskCalendarKey: string;
  /** Up to 3 health batches from the last 7 days (for gateway / full companion prompt only). */
  recentHealthSnapshots: HealthSnapshot[];
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
  const capabilitiesPromise = getCapabilitiesForModel(chatModel);

  const healthSince = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const now = new Date();
  const dayTaskCalendarKey = computeWindowKey(now, getNightReviewTimezone());

  const [memoriesOutcome, goalsOutcome, dayTasksOutcome, healthOutcome] =
    await Promise.allSettled([
      getRecentMemories({
        userId,
        since: getMemoryPromptSince(),
        limit: getMemoryPromptFetchLimit(),
      }),
      listActiveGoalsForUser({ userId, limit: 12 }),
      listDayTasksForUser({ userId, forDate: dayTaskCalendarKey }),
      listHealthSnapshotsForUser({
        userId,
        limit: 3,
        createdAfter: healthSince,
      }),
    ]);
  const capabilities = await capabilitiesPromise;

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

  let dayTasksToday: DayTask[] = [];
  if (dayTasksOutcome.status === "fulfilled") {
    dayTasksToday = dayTasksOutcome.value;
  } else {
    agentIngestLogSession308ef5({
      hypothesisId: "prompt-ctx-day-tasks",
      location: "load-prompt-context.ts:listDayTasksForUser",
      message: "listDayTasksForUser rejected",
      data: {
        errorMessage: rejectionMessage(dayTasksOutcome.reason).slice(0, 500),
      },
    });
  }

  let recentHealthSnapshots: HealthSnapshot[] = [];
  if (healthOutcome.status === "fulfilled") {
    recentHealthSnapshots = healthOutcome.value;
  } else {
    agentIngestLogSession308ef5({
      hypothesisId: "prompt-ctx-health",
      location: "load-prompt-context.ts:listHealthSnapshotsForUser",
      message: "listHealthSnapshotsForUser rejected",
      data: {
        errorMessage: rejectionMessage(healthOutcome.reason).slice(0, 500),
      },
    });
  }

  return {
    capabilities,
    recentMemories,
    activeGoals,
    dayTasksToday,
    dayTaskCalendarKey,
    recentHealthSnapshots,
  };
}
