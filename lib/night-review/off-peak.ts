/**
 * Off-peak window for deferring token/CPU-heavy jobs (e.g. night review).
 * Default: 23:00–07:00 local, end hour exclusive (last slot ends before 07:00).
 */

export type OffPeakBounds = {
  /** Inclusive (0–23), e.g. 23 = 11pm */
  startHour: number;
  /** Exclusive (0–23), e.g. 7 = window ends before 7:00 */
  endHourExclusive: number;
};

export function getLocalHourMinute(
  now: Date,
  timeZone: string
): { hour: number; minute: number } {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour: "numeric",
    minute: "numeric",
    hourCycle: "h23",
  }).formatToParts(now);
  const hourRaw = parts.find((p) => p.type === "hour")?.value;
  const minuteRaw = parts.find((p) => p.type === "minute")?.value;
  const hour = Number(hourRaw);
  const minute = Number(minuteRaw);
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) {
    return { hour: 0, minute: 0 };
  }
  return { hour, minute };
}

/** True when local clock hour lies in [startHour, 24) ∪ [0, endHourExclusive). */
export function isHourWithinOffPeak(
  hour: number,
  bounds: OffPeakBounds
): boolean {
  const { startHour, endHourExclusive } = bounds;
  if (startHour === endHourExclusive) {
    return false;
  }
  if (startHour > endHourExclusive) {
    return hour >= startHour || hour < endHourExclusive;
  }
  return hour >= startHour && hour < endHourExclusive;
}

/** True when runHour is a valid slot inside the off-peak band (for config validation). */
export function isRunHourAllowedForOffPeak(
  runHour: number,
  bounds: OffPeakBounds
): boolean {
  return isHourWithinOffPeak(runHour, bounds);
}

/**
 * True when `now` in `timeZone` is the single cron slot: local hour matches
 * `runLocalHour` and that hour falls inside off-peak bounds.
 * Cron should invoke at least once during that local hour (e.g. Vercel daily
 * UTC — see `vercel.json`; align UTC with `NIGHT_REVIEW_TIMEZONE` and
 * `NIGHT_REVIEW_RUN_LOCAL_HOUR`; Hobby cannot use hourly schedules).
 */
export function isNightReviewCronEnqueueSlot(
  now: Date,
  timeZone: string,
  bounds: OffPeakBounds,
  runLocalHour: number
): boolean {
  if (!isRunHourAllowedForOffPeak(runLocalHour, bounds)) {
    return false;
  }
  const { hour } = getLocalHourMinute(now, timeZone);
  if (hour !== runLocalHour) {
    return false;
  }
  return isHourWithinOffPeak(hour, bounds);
}

/** Use for other deferred jobs: true when local time falls in the off-peak band. */
export function isNowWithinOffPeakLocal(
  now: Date,
  timeZone: string,
  bounds: OffPeakBounds
): boolean {
  const { hour } = getLocalHourMinute(now, timeZone);
  return isHourWithinOffPeak(hour, bounds);
}
