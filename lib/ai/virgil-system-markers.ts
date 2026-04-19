/**
 * Separates the Virgil persona frame from session data and tool instructions within
 * the single `streamText` `system` string. Providers receive `system` as its own
 * field (before `messages`); this divider keeps the persona block first *inside* that
 * string so memory/tool sections cannot precede voice rules.
 */
export const VIRGIL_SYSTEM_PERSONA_DIVIDER =
  "\n\n---\n\n## Session, memory, and tool context\n\n";
