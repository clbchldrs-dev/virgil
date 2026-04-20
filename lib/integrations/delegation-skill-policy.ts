/**
 * Virgil-side skill policy for `delegateTask` / embed delegation.
 *
 * **Default (recommended for “use whatever tools exist on the gateway”):** leave
 * `VIRGIL_DELEGATION_STRICT_SKILLS` unset. Unknown skill names are forwarded;
 * OpenClaw/Hermes apply the real allow/deny policy (`gateway.tools`, session
 * policy, etc. on the gateway host — not configurable from this repo).
 *
 * **Strict:** set `VIRGIL_DELEGATION_STRICT_SKILLS=1` to reject skill ids that
 * do not appear in the merged bridge skill list (GET catalog + `OPENCLAW_SKILLS_STATIC`).
 */
export function isDelegationStrictSkillAllowlist(): boolean {
  return process.env.VIRGIL_DELEGATION_STRICT_SKILLS?.trim() === "1";
}
