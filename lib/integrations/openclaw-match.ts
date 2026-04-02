const DESTRUCTIVE_PATTERN =
  /\b(delete|remove|rm\s|unlink|truncate|format|send\s|whatsapp|slack|dm|message|text\s|shell|execute|exec|run\s+sudo)\b/i;

export function delegationNeedsConfirmation(
  description: string,
  skill: string
): boolean {
  const hay = `${description} ${skill}`.toLowerCase();
  return DESTRUCTIVE_PATTERN.test(hay);
}

function tokenize(s: string): Set<string> {
  return new Set(
    s
      .toLowerCase()
      .split(/[^a-z0-9]+/u)
      .filter((w) => w.length > 2)
  );
}

/**
 * Pick best skill by token overlap with description (no LLM).
 */
export function matchSkillFromDescription(
  description: string,
  skills: string[]
): string | undefined {
  if (skills.length === 0) {
    return undefined;
  }
  const descTokens = tokenize(description);
  let best: { skill: string; score: number } | undefined;
  for (const skill of skills) {
    const skillTokens = tokenize(skill.replace(/-/gu, " "));
    let score = 0;
    for (const t of skillTokens) {
      if (descTokens.has(t)) {
        score += 1;
      }
    }
    if (!best || score > best.score) {
      best = { skill, score };
    }
  }
  if (!best || best.score < 1) {
    return undefined;
  }
  return best.skill;
}
