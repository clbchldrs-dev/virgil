type NightReviewOwner = {
  id: string;
  email: string;
};

type NightReviewModelResolution = { ok: true } | { ok: false; reason: string };

export type NightReviewEnqueueDeps = {
  cronSecret: string | undefined;
  isEnabled: () => boolean;
  shouldEnqueueNow: (now: Date) => boolean;
  getTimezone: () => string;
  getOffPeakBounds: () => { startHour: number; endHourExclusive: number };
  getRunLocalHour: () => number;
  getModelId: () => string;
  resolveModel: (modelId: string) => NightReviewModelResolution;
  isQstashConfigured: () => boolean;
  getOwners: () => Promise<NightReviewOwner[]>;
  computeWindow: (now: Date) => { windowStart: Date; windowEnd: Date };
  computeWindowKey: (windowEnd: Date, timezone: string) => string;
  generateRunId: () => string;
  getBaseUrl: () => string;
  getStaggerSeconds: () => number;
  publish: (input: {
    url: string;
    body: {
      userId: string;
      windowStart: string;
      windowEnd: string;
      runId: string;
      windowKey: string;
    };
    delay: number;
  }) => Promise<void>;
  now: () => Date;
};

export async function handleNightReviewEnqueueGet(
  request: Request,
  deps: NightReviewEnqueueDeps
): Promise<Response> {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${deps.cronSecret}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  if (!deps.isEnabled()) {
    return Response.json({ ok: true, skipped: true, reason: "disabled" });
  }

  const now = deps.now();
  if (!deps.shouldEnqueueNow(now)) {
    return Response.json({
      ok: true,
      skipped: true,
      reason: "outside_off_peak_slot",
      timezone: deps.getTimezone(),
      offPeak: deps.getOffPeakBounds(),
      runLocalHour: deps.getRunLocalHour(),
    });
  }

  const nightModelId = deps.getModelId();
  const modelResolved = deps.resolveModel(nightModelId);
  if (!modelResolved.ok) {
    return Response.json({
      ok: true,
      skipped: true,
      reason: "night_review_model_not_allowed",
      detail: modelResolved.reason,
    });
  }

  if (!deps.isQstashConfigured()) {
    return Response.json(
      { ok: false, error: "QSTASH_TOKEN is not set" },
      { status: 500 }
    );
  }

  const { windowStart, windowEnd } = deps.computeWindow(now);
  const timezone = deps.getTimezone();
  const windowKey = deps.computeWindowKey(windowEnd, timezone);
  const runId = deps.generateRunId();
  const base = deps.getBaseUrl();
  const staggerSeconds = deps.getStaggerSeconds();

  const owners = await deps.getOwners();
  const failures: Array<{ ownerId: string; message: string }> = [];
  let guestOwnersSkipped = 0;
  let eligibleOwners = 0;
  let enqueued = 0;
  let index = 0;

  for (const owner of owners) {
    if (owner.email.startsWith("guest-")) {
      guestOwnersSkipped += 1;
      continue;
    }
    eligibleOwners += 1;
    try {
      await deps.publish({
        url: `${base}/api/night-review/run`,
        body: {
          userId: owner.id,
          windowStart: windowStart.toISOString(),
          windowEnd: windowEnd.toISOString(),
          runId,
          windowKey,
        },
        delay: index * staggerSeconds,
      });
      enqueued += 1;
      index += 1;
    } catch (error) {
      failures.push({
        ownerId: owner.id,
        message: error instanceof Error ? error.message : "unknown_error",
      });
    }
  }

  return Response.json({
    ok: true,
    runId,
    windowKey,
    staggerSeconds,
    summary: {
      ownersScanned: owners.length,
      guestOwnersSkipped,
      eligibleOwners,
      enqueued,
      publishFailures: failures.length,
    },
    failures,
  });
}
