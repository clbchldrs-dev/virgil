import type { DelegationReadiness } from "@/lib/integrations/delegation-readiness";

export type DelegationPreflightDecision = {
  ok: boolean;
  reason: "resolved_skill_not_advertised" | "ok";
  message: string | null;
};

/**
 * Phase-3 enforced preflight: only block when the gateway advertises skills
 * and the resolved skill is explicitly missing. This avoids false negatives
 * when a backend does not provide a skills list.
 */
export function evaluateDelegationPreflight(args: {
  readiness: DelegationReadiness;
  advertisedSkillCount: number;
}): DelegationPreflightDecision {
  if (args.advertisedSkillCount <= 0) {
    return { ok: true, reason: "ok", message: null };
  }
  if (!args.readiness.resolvedSkillAdvertised) {
    return {
      ok: false,
      reason: "resolved_skill_not_advertised",
      message:
        `Preflight blocked delegation: resolved skill "${args.readiness.resolvedSkill}" ` +
        "is not advertised by the configured backend contract.",
    };
  }
  return { ok: true, reason: "ok", message: null };
}
