import type { DelegationSkillDescriptor } from "@/lib/integrations/openclaw-types";

export type DelegationReadiness = {
  score: number;
  recommendation: "delegate" | "queue_or_confirm" | "ask_for_clarification";
  reasons: string[];
  online: boolean;
  resolvedSkill: string;
  resolvedSkillAdvertised: boolean;
  providedSkill: string | null;
};

function clampScore(value: number): number {
  if (value < 0) {
    return 0;
  }
  if (value > 1) {
    return 1;
  }
  return Number(value.toFixed(2));
}

/**
 * Advisory-only scoring for delegation confidence.
 * This is intentionally lightweight and deterministic; it never blocks send.
 */
export function evaluateDelegationReadiness(args: {
  online: boolean;
  providedSkill?: string;
  resolvedSkill: string;
  skillDescriptors: DelegationSkillDescriptor[];
}): DelegationReadiness {
  const providedSkill = args.providedSkill?.trim() || null;
  const advertised = new Set(args.skillDescriptors.map((s) => s.id));
  const resolvedSkillAdvertised = advertised.has(args.resolvedSkill);

  const reasons: string[] = [];
  let score = 0.5;

  if (args.online) {
    score += 0.25;
    reasons.push("gateway is reachable");
  } else {
    score -= 0.45;
    reasons.push("gateway appears offline");
  }

  if (args.skillDescriptors.length > 0) {
    score += 0.15;
    reasons.push("skills contract is available");
  } else {
    score -= 0.2;
    reasons.push("skills contract unavailable");
  }

  if (resolvedSkillAdvertised) {
    score += 0.2;
    reasons.push(`resolved skill "${args.resolvedSkill}" is advertised`);
  } else {
    score -= 0.35;
    reasons.push(`resolved skill "${args.resolvedSkill}" is not advertised`);
  }

  if (providedSkill) {
    if (providedSkill === args.resolvedSkill && resolvedSkillAdvertised) {
      score += 0.1;
      reasons.push("explicit skill matches an advertised skill");
    } else if (!advertised.has(providedSkill)) {
      score -= 0.1;
      reasons.push(`provided skill "${providedSkill}" is not advertised`);
    }
  }

  const finalScore = clampScore(score);
  let recommendation: DelegationReadiness["recommendation"];
  if (!args.online || finalScore < 0.45) {
    recommendation = "ask_for_clarification";
  } else if (finalScore < 0.65) {
    recommendation = "queue_or_confirm";
  } else {
    recommendation = "delegate";
  }

  return {
    score: finalScore,
    recommendation,
    reasons,
    online: args.online,
    resolvedSkill: args.resolvedSkill,
    resolvedSkillAdvertised,
    providedSkill,
  };
}
