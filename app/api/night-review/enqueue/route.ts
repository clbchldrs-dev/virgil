import { getUsersEligibleForCompanionBackgroundJobs } from "@/lib/db/queries";
import {
  computeNightReviewWindow,
  computeWindowKey,
  getNightReviewModelId,
  getNightReviewOffPeakBounds,
  getNightReviewRunLocalHour,
  getNightReviewStaggerSeconds,
  getNightReviewTimezone,
  isNightReviewEnabled,
  shouldNightReviewCronEnqueueNow,
} from "@/lib/night-review/config";
import {
  getNightReviewChatModelProfile,
  resolveNightReviewLanguageModel,
} from "@/lib/night-review/night-review-model";
import { getQStashPublishClient } from "@/lib/qstash/publish-client";
import { handleNightReviewEnqueueGet } from "@/lib/reliability/night-review-enqueue-handler";
import { generateUUID } from "@/lib/utils";

function getBaseUrl(): string {
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`;
  }
  return process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
}

export function GET(request: Request) {
  return handleNightReviewEnqueueGet(request, {
    cronSecret: process.env.CRON_SECRET,
    isEnabled: isNightReviewEnabled,
    shouldEnqueueNow: shouldNightReviewCronEnqueueNow,
    getTimezone: getNightReviewTimezone,
    getOffPeakBounds: getNightReviewOffPeakBounds,
    getRunLocalHour: getNightReviewRunLocalHour,
    getModelId: getNightReviewModelId,
    resolveModel: (modelId) => {
      return resolveNightReviewLanguageModel(
        modelId,
        getNightReviewChatModelProfile(modelId)?.ollamaOptions
      );
    },
    isQstashConfigured: () => Boolean(process.env.QSTASH_TOKEN?.trim()),
    getOwners: getUsersEligibleForCompanionBackgroundJobs,
    computeWindow: computeNightReviewWindow,
    computeWindowKey,
    generateRunId: generateUUID,
    getBaseUrl,
    getStaggerSeconds: getNightReviewStaggerSeconds,
    publish: async ({ url, body, delay }) => {
      await getQStashPublishClient().publishJSON({ url, body, delay });
    },
    now: () => new Date(),
  });
}
