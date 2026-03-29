import "server-only";

const TRUE = new Set(["1", "true", "yes"]);

export function isNightReviewEnabled(): boolean {
  const v = process.env.NIGHT_REVIEW_ENABLED?.toLowerCase().trim();
  return v ? TRUE.has(v) : false;
}

/** Model id for generateObject (Ollama or gateway), e.g. ollama/qwen2.5:7b-instruct */
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
