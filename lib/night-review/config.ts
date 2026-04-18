import "server-only";

import {
  isNightReviewCronEnqueueSlot,
  type OffPeakBounds,
} from "@/lib/night-review/off-peak";

const TRUE = new Set(["1", "true", "yes"]);
const FALSE = new Set(["0", "false", "no", "off"]);

function parseHourEnv(raw: string | undefined, fallback: number): number {
  const t = raw?.trim();
  if (!t) {
    return fallback;
  }
  const n = Number(t);
  if (!Number.isFinite(n) || n < 0 || n > 23) {
    return fallback;
  }
  return Math.floor(n);
}

/** Local off-peak band for deferred night jobs (default 23:00–07:00, end exclusive). */
export function getNightReviewOffPeakBounds(): OffPeakBounds {
  return {
    startHour: parseHourEnv(process.env.NIGHT_REVIEW_OFF_PEAK_START_HOUR, 23),
    endHourExclusive: parseHourEnv(
      process.env.NIGHT_REVIEW_OFF_PEAK_END_HOUR,
      7
    ),
  };
}

/**
 * Local clock hour (0–23 in {@link getNightReviewTimezone}) when cron should enqueue
 * exactly once per night. Must fall inside the off-peak band (default **23** = 11:00pm).
 */
export function getNightReviewRunLocalHour(): number {
  return parseHourEnv(process.env.NIGHT_REVIEW_RUN_LOCAL_HOUR, 23);
}

/**
 * True when the cron caller should enqueue (scheduled GET + local slot).
 * Manual `/api/night-review/trigger` does not use this — it allows daytime tests.
 */
export function shouldNightReviewCronEnqueueNow(now: Date): boolean {
  return isNightReviewCronEnqueueSlot(
    now,
    getNightReviewTimezone(),
    getNightReviewOffPeakBounds(),
    getNightReviewRunLocalHour()
  );
}

/**
 * Night review enqueue (`/api/night-review/enqueue`) runs only when this is true.
 *
 * - **Vercel production** (`VERCEL_ENV=production`): enabled by default when
 *   `NIGHT_REVIEW_ENABLED` is unset, so `vercel.json` cron is not a no-op.
 * - **Local / preview / self-hosted**: opt-in with `NIGHT_REVIEW_ENABLED=1` (or
 *   `true` / `yes`). Set `NIGHT_REVIEW_ENABLED=0` (or `false` / `no` / `off`)
 *   to disable explicitly, including on Vercel production.
 */
export function isNightReviewEnabled(): boolean {
  const raw = process.env.NIGHT_REVIEW_ENABLED?.trim();
  if (raw) {
    const v = raw.toLowerCase();
    if (FALSE.has(v)) {
      return false;
    }
    if (TRUE.has(v)) {
      return true;
    }
    return false;
  }
  return process.env.VERCEL_ENV === "production";
}

/**
 * Model id for night-review `generateObject`. Must be `ollama/…` only (local inference).
 */
export function getNightReviewModelId(): string {
  return process.env.NIGHT_REVIEW_MODEL?.trim() || "ollama/qwen2.5:7b-review";
}

export function getNightReviewStaggerSeconds(): number {
  const raw = Number(process.env.NIGHT_REVIEW_STAGGER_SECONDS);
  return Number.isFinite(raw) && raw >= 0 ? Math.floor(raw) : 60;
}

export function getNightReviewTimezone(): string {
  return process.env.NIGHT_REVIEW_TIMEZONE?.trim() || "America/New_York";
}

/** Calendar key for idempotency (date of window end in configured TZ). */
export function computeWindowKey(end: Date, timeZone: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(end);
}

export function computeNightReviewWindow(
  now: Date,
  hoursBack = 24
): { windowStart: Date; windowEnd: Date } {
  const windowEnd = now;
  const windowStart = new Date(now.getTime() - hoursBack * 60 * 60 * 1000);
  return { windowStart, windowEnd };
}
