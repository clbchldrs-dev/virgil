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
import { runNightReviewForUser } from "@/lib/night-review/run-night-review";
import { shouldRunNightReviewTriggerInline } from "@/lib/night-review/trigger-inline-destination";
import { getQStashPublishClient } from "@/lib/qstash/publish-client";
import { generateUUID } from "@/lib/utils";

/** Same budget as `POST /api/night-review/run` when trigger runs the worker inline. */
export const maxDuration = 300;

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
  const payload = {
    userId,
    windowStart: windowStart.toISOString(),
    windowEnd: windowEnd.toISOString(),
    runId,
    windowKey,
  };

  if (shouldRunNightReviewTriggerInline(base)) {
    try {
      const result = await runNightReviewForUser(payload);
      return NextResponse.json({
        ok: true,
        runId,
        windowKey,
        worker: "inline" as const,
        skipped: result.skipped,
        reason: result.reason,
        message: result.skipped
          ? `Night review skipped (${result.reason ?? "unknown"}).`
          : "Night review finished. Refresh Night insights to see results.",
      });
    } catch (e) {
      console.error("Night review inline trigger failed:", e);
      return NextResponse.json(
        {
          ok: false,
          error: "Night review run failed",
          code: "inline_run_failed" as const,
          detail: e instanceof Error ? e.message : String(e),
        },
        { status: 500 }
      );
    }
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

  const qstash = getQStashPublishClient();

  try {
    await qstash.publishJSON({
      url: `${base}/api/night-review/run`,
      body: payload,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error("Night review trigger QStash publish failed:", e);
    return NextResponse.json(
      {
        ok: false,
        error: "Could not queue night review",
        code: "qstash_publish_failed" as const,
        detail: message,
      },
      { status: 502 }
    );
  }

  return NextResponse.json({
    ok: true,
    runId,
    windowKey,
    worker: "qstash" as const,
    message:
      "Night review queued. Results usually appear on Night insights within a few minutes.",
  });
}
