/**
 * When false (default), delegateTask does not reject unknown skill ids — the gateway decides.
 * Set VIRGIL_DELEGATION_STRICT_SKILLS=1 to require skill names to appear in the bridge catalog.
 */
export function isDelegationStrictSkillAllowlist(): boolean {
  return process.env.VIRGIL_DELEGATION_STRICT_SKILLS?.trim() === "1";
}
