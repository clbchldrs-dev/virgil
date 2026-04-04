/**
 * How many `Memory` rows are loaded for the chat system prompt (before slim/full formatting).
 * Tunable so operators can widen recall without a code change.
 */
const DEFAULT_MEMORY_PROMPT_WINDOW_DAYS = 30;
const DEFAULT_MEMORY_PROMPT_FETCH_LIMIT = 80;

function resolveMemoryPromptWindowDays(): number {
  const raw = process.env.MEMORY_PROMPT_WINDOW_DAYS;
  if (!raw) {
    return DEFAULT_MEMORY_PROMPT_WINDOW_DAYS;
  }
  const n = Number.parseInt(raw, 10);
  if (Number.isFinite(n) && n >= 1 && n <= 365) {
    return n;
  }
  return DEFAULT_MEMORY_PROMPT_WINDOW_DAYS;
}

function resolveMemoryPromptFetchLimit(): number {
  const raw = process.env.MEMORY_PROMPT_FETCH_LIMIT;
  if (!raw) {
    return DEFAULT_MEMORY_PROMPT_FETCH_LIMIT;
  }
  const n = Number.parseInt(raw, 10);
  if (Number.isFinite(n) && n >= 1 && n <= 200) {
    return n;
  }
  return DEFAULT_MEMORY_PROMPT_FETCH_LIMIT;
}

/** Start of calendar window for `getRecentMemories` (UTC-consistent day length). */
export function getMemoryPromptSince(): Date {
  const days = resolveMemoryPromptWindowDays();
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000);
}

export function getMemoryPromptFetchLimit(): number {
  return resolveMemoryPromptFetchLimit();
}
