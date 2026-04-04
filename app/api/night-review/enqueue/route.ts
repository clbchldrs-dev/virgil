import { Client } from "@upstash/qstash";
import { NextResponse } from "next/server";
import { getUsersEligibleForCompanionBackgroundJobs } from "@/lib/db/queries";
import {
  computeNightReviewWindow,
  computeWindowKey,
  getNightReviewModelId,
  getNightReviewStaggerSeconds,
  getNightReviewTimezone,
  isNightReviewEnabled,
} from "@/lib/night-review/config";
import {
  getNightReviewChatModelProfile,
  resolveNightReviewLanguageModel,
} from "@/lib/night-review/night-review-model";
import { generateUUID } from "@/lib/utils";

function getQStashClient(token: string) {
  return new Client({ token });
}

function getBaseUrl(): string {
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`;
  }
  return process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
}

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  if (!isNightReviewEnabled()) {
    return NextResponse.json({ ok: true, skipped: true, reason: "disabled" });
  }

  const nightModelId = getNightReviewModelId();
  const nightModelResolved = resolveNightReviewLanguageModel(
    nightModelId,
    getNightReviewChatModelProfile(nightModelId)?.ollamaOptions
  );
  if (!nightModelResolved.ok) {
    return NextResponse.json({
      ok: true,
      skipped: true,
      reason: "night_review_model_not_allowed",
      detail: nightModelResolved.reason,
    });
  }

  const qstashToken = process.env.QSTASH_TOKEN;
  if (!qstashToken) {
    return NextResponse.json(
      { ok: false, error: "QSTASH_TOKEN is not set" },
      { status: 500 }
    );
  }

  const qstash = getQStashClient(qstashToken);

  const now = new Date();
  const { windowStart, windowEnd } = computeNightReviewWindow(now);
  const windowKey = computeWindowKey(windowEnd, getNightReviewTimezone());
  const runId = generateUUID();
  const base = getBaseUrl();
  const stagger = getNightReviewStaggerSeconds();

  const owners = await getUsersEligibleForCompanionBackgroundJobs();
  let enqueued = 0;
  let index = 0;

  for (const owner of owners) {
    if (owner.email.startsWith("guest-")) {
      continue;
    }
    await qstash.publishJSON({
      url: `${base}/api/night-review/run`,
      body: {
        userId: owner.id,
        windowStart: windowStart.toISOString(),
        windowEnd: windowEnd.toISOString(),
        runId,
        windowKey,
      },
      delay: index * stagger,
    });
    index += 1;
    enqueued += 1;
  }

  return NextResponse.json({
    ok: true,
    runId,
    windowKey,
    enqueued,
    staggerSeconds: stagger,
  });
}
