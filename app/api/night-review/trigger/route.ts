import { NextResponse } from "next/server";
import { auth } from "@/app/(auth)/auth";
import { hasCompletedNightReviewForWindow } from "@/lib/db/queries";
import {
  computeNightReviewWindow,
  computeWindowKey,
  getNightReviewModelId,
  getNightReviewTimezone,
  isNightReviewEnabled,
} from "@/lib/night-review/config";
import {
  getNightReviewChatModelProfile,
  resolveNightReviewLanguageModel,
} from "@/lib/night-review/night-review-model";
import { getQStashPublishClient } from "@/lib/qstash/publish-client";
import { generateUUID } from "@/lib/utils";

function getBaseUrl(): string {
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`;
  }
  return process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
}

/**
 * Queue a night-review run for the signed-in user (same window as cron).
 * Requires QStash (same as scheduled enqueue). Returns 409 if this window already completed.
 */
export async function POST() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json(
      { ok: false, error: "Unauthorized" },
      { status: 401 }
    );
  }

  const email = session.user.email ?? "";
  if (email.startsWith("guest-")) {
    return NextResponse.json(
      { ok: false, error: "Guest accounts cannot trigger night review" },
      { status: 403 }
    );
  }

  if (!isNightReviewEnabled()) {
    return NextResponse.json(
      {
        ok: false,
        error: "Night review is disabled",
        code: "disabled" as const,
      },
      { status: 400 }
    );
  }

  const nightModelId = getNightReviewModelId();
  const nightModelResolved = resolveNightReviewLanguageModel(
    nightModelId,
    getNightReviewChatModelProfile(nightModelId)?.ollamaOptions
  );
  if (!nightModelResolved.ok) {
    return NextResponse.json(
      {
        ok: false,
        error: "Night review model is not configured",
        code: "model_not_configured" as const,
        detail: nightModelResolved.reason,
      },
      { status: 503 }
    );
  }

  const qstashToken = process.env.QSTASH_TOKEN;
  if (!qstashToken) {
    return NextResponse.json(
      {
        ok: false,
        error: "QSTASH_TOKEN is not set",
        code: "qstash_missing" as const,
      },
      { status: 500 }
    );
  }

  const now = new Date();
  const { windowStart, windowEnd } = computeNightReviewWindow(now);
  const windowKey = computeWindowKey(windowEnd, getNightReviewTimezone());
  const userId = session.user.id;

  const alreadyDone = await hasCompletedNightReviewForWindow({
    userId,
    windowKey,
  });
  if (alreadyDone) {
    return NextResponse.json(
      {
        ok: false,
        skipped: true,
        reason: "already_completed" as const,
        windowKey,
        message:
          "Night review already finished for this window. The next run uses a new window when the schedule fires.",
      },
      { status: 409 }
    );
  }

  const runId = generateUUID();
  const base = getBaseUrl();
  const qstash = getQStashPublishClient();

  await qstash.publishJSON({
    url: `${base}/api/night-review/run`,
    body: {
      userId,
      windowStart: windowStart.toISOString(),
      windowEnd: windowEnd.toISOString(),
      runId,
      windowKey,
    },
  });

  return NextResponse.json({
    ok: true,
    runId,
    windowKey,
    message:
      "Night review queued. Results usually appear on Night insights within a few minutes.",
  });
}
