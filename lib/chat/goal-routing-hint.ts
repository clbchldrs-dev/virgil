const WEEKLY_SHORT_PREFIX =
  "[Weekly summary — SHORT: TL;DR, METRICS, NEXT WEEK'S LEVER only. One combined recallMemory if needed.]\n\n";

const WEEKLY_FULL_PREFIX =
  "[Weekly summary — use full WEEKLY SUMMARY template; at most one combined recallMemory query.]\n\n";

const DECISION_PREFIX =
  "[Decision help — use DECISION POINT format; one combined recallMemory query max.]\n\n";

const BLOCKER_PREFIX =
  "[Blocker / pattern — use BLOCKER ALERT format; one recallMemory for mitigations max, then optional saveMemory if user approves.]\n\n";

/**
 * Prepends routing hints for `/weekly`, `/decision`, `/blocker` messages (client-only).
 * Does not remove the slash line from the visible message; the model sees both hint and user text.
 */
export function applyGoalRoutingHint(userText: string): string {
  const trimmed = userText.trimStart();
  if (/^\/weekly\s+short\b/i.test(trimmed)) {
    const rest = trimmed.replace(/^\/weekly\s+short\s*/i, "").trimStart();
    return `${WEEKLY_SHORT_PREFIX}${rest}`;
  }
  if (/^\/weekly\b/i.test(trimmed)) {
    const rest = trimmed.replace(/^\/weekly\s*/i, "").trimStart();
    return `${WEEKLY_FULL_PREFIX}${rest}`;
  }
  if (/^\/decision\b/i.test(trimmed)) {
    const rest = trimmed.replace(/^\/decision\s*/i, "").trimStart();
    return `${DECISION_PREFIX}${rest}`;
  }
  if (/^\/blocker\b/i.test(trimmed)) {
    const rest = trimmed.replace(/^\/blocker\s*/i, "").trimStart();
    return `${BLOCKER_PREFIX}${rest}`;
  }
  return userText;
}
