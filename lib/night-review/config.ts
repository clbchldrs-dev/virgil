import "server-only";

const TRUE = new Set(["1", "true", "yes"]);
const FALSE = new Set(["0", "false", "no", "off"]);

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
 * Model id for night-review `generateObject`. Must be `ollama/…` (local) or `google/…`
 * (Gemini with `GOOGLE_GENERATIVE_AI_API_KEY`). Other gateway ids are rejected.
 */
export function getNightReviewModelId(): string {
  return process.env.NIGHT_REVIEW_MODEL?.trim() || "ollama/qwen2.5:7b-review";
}

export function getNightReviewStaggerSeconds(): number {
  const raw = Number(process.env.NIGHT_REVIEW_STAGGER_SECONDS);
  return Number.isFinite(raw) && raw >= 0 ? Math.floor(raw) : 60;
}

export function getNightReviewTimezone(): string {
  return process.env.NIGHT_REVIEW_TIMEZONE?.trim() || "UTC";
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
