const DRAFT_PREFIX = "virgil-weekly-draft:";

function getIsoWeekKey(d: Date): string {
  const target = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNum = target.getUTCDay() || 7;
  target.setUTCDate(target.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(target.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(
    ((target.getTime() - yearStart.getTime()) / 86_400_000 + 1) / 7
  );
  return `${target.getUTCFullYear()}-W${String(weekNo).padStart(2, "0")}`;
}

export function getWeeklyDraftStorageKey(): string {
  return `${DRAFT_PREFIX}${getIsoWeekKey(new Date())}`;
}

export function loadWeeklyDraftIfAny(): string | null {
  if (typeof window === "undefined") {
    return null;
  }
  try {
    return window.localStorage.getItem(getWeeklyDraftStorageKey());
  } catch {
    return null;
  }
}

export function saveWeeklyDraft(text: string): void {
  if (typeof window === "undefined") {
    return;
  }
  try {
    window.localStorage.setItem(getWeeklyDraftStorageKey(), text);
  } catch {
    /* ignore quota */
  }
}

export function clearWeeklyDraft(): void {
  if (typeof window === "undefined") {
    return;
  }
  try {
    window.localStorage.removeItem(getWeeklyDraftStorageKey());
  } catch {
    /* ignore */
  }
}

export function shouldPersistWeeklyDraft(text: string): boolean {
  const t = text.trimStart();
  return /^\/weekly\b/i.test(t) || /^WK:/i.test(t);
}
