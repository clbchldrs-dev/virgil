const DEFAULT_MIN_PRIORITIES = 3;
const DEFAULT_MAX_PRIORITIES = 7;

const DEFAULT_STALENESS_GENTLE_DAYS = 2;
const DEFAULT_STALENESS_RESET_DAYS = 6;
const DEFAULT_STALENESS_ACCOUNTABILITY_DAYS = 12;

function readPositiveIntFromEnv(name: string, fallback: number): number {
  const raw = process.env[name];
  if (raw === undefined || raw === "") {
    return fallback;
  }
  const trimmed = raw.trim();
  if (trimmed === "" || !/^\d+$/.test(trimmed)) {
    return fallback;
  }
  const n = Number.parseInt(trimmed, 10);
  if (!Number.isSafeInteger(n) || n < 1) {
    return fallback;
  }
  return n;
}

function resolveAdaptiveRange(): { min: number; max: number } {
  const min = readPositiveIntFromEnv(
    "SOPHON_ADAPTIVE_MIN",
    DEFAULT_MIN_PRIORITIES
  );
  const max = readPositiveIntFromEnv(
    "SOPHON_ADAPTIVE_MAX",
    DEFAULT_MAX_PRIORITIES
  );
  if (min > max) {
    return {
      min: DEFAULT_MIN_PRIORITIES,
      max: DEFAULT_MAX_PRIORITIES,
    };
  }
  return { min, max };
}

function resolveStalenessThresholds(): {
  gentleDays: number;
  resetDays: number;
  accountabilityDays: number;
} {
  const gentle = readPositiveIntFromEnv(
    "SOPHON_STALENESS_GENTLE_DAYS",
    DEFAULT_STALENESS_GENTLE_DAYS
  );
  const reset = readPositiveIntFromEnv(
    "SOPHON_STALENESS_RESET_DAYS",
    DEFAULT_STALENESS_RESET_DAYS
  );
  const accountability = readPositiveIntFromEnv(
    "SOPHON_STALENESS_ACCOUNTABILITY_DAYS",
    DEFAULT_STALENESS_ACCOUNTABILITY_DAYS
  );
  if (!(gentle < reset && reset < accountability)) {
    return {
      gentleDays: DEFAULT_STALENESS_GENTLE_DAYS,
      resetDays: DEFAULT_STALENESS_RESET_DAYS,
      accountabilityDays: DEFAULT_STALENESS_ACCOUNTABILITY_DAYS,
    };
  }
  return {
    gentleDays: gentle,
    resetDays: reset,
    accountabilityDays: accountability,
  };
}

const adaptive = resolveAdaptiveRange();
export const SOPHON_MIN_PRIORITIES = adaptive.min;
export const SOPHON_MAX_PRIORITIES = adaptive.max;

const staleness = resolveStalenessThresholds();
export const SOPHON_STALENESS_GENTLE_DAYS = staleness.gentleDays;
export const SOPHON_STALENESS_RESET_DAYS = staleness.resetDays;
export const SOPHON_STALENESS_ACCOUNTABILITY_DAYS =
  staleness.accountabilityDays;

export const SOPHON_WEIGHTS = {
  impact: 0.28,
  urgency: 0.26,
  commitmentRisk: 0.2,
  effortFit: 0.14,
  decayRisk: 0.12,
} as const;
