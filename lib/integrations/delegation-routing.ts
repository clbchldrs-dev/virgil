import { matchSkillFromDescription } from "@/lib/integrations/openclaw-match";

export type DelegationRoutingTrace = {
  policyVersion: "v1";
  providedSkill: string | null;
  lane: string | null;
  taskType: string | null;
  strategy:
    | "explicit_skill"
    | "lane_policy"
    | "task_type_policy"
    | "description_match"
    | "fallback_generic";
  candidates: string[];
  matchedSkillFromDescription: string | null;
  resolvedSkill: string;
};

const LANE_CANDIDATES: Record<string, string[]> = {
  code: ["coding-agent", "sessions_spawn", "generic-task"],
  research: ["web_search", "web_fetch", "generic-task"],
  chat: ["message", "generic-task"],
  home: ["generic-task"],
};

const TASK_TYPE_CANDIDATES: Record<string, string[]> = {
  bug: ["coding-agent", "sessions_spawn", "generic-task"],
  feature: ["coding-agent", "sessions_spawn", "generic-task"],
  refactor: ["coding-agent", "sessions_spawn", "generic-task"],
  prompt: ["generic-task"],
  docs: ["generic-task"],
  infra: ["sessions_spawn", "generic-task"],
};

function unique(values: string[]): string[] {
  return [...new Set(values.filter((v) => v.trim().length > 0))];
}

function pickFirstAdvertised(
  candidates: string[],
  advertisedSkillIds: Set<string>
): string | null {
  for (const candidate of candidates) {
    if (advertisedSkillIds.has(candidate)) {
      return candidate;
    }
  }
  return null;
}

export function resolveDelegationSkill(args: {
  description: string;
  providedSkill?: string;
  lane?: string;
  taskType?: string;
  advertisedSkills: string[];
}): { resolvedSkill: string; trace: DelegationRoutingTrace } {
  const providedSkill = args.providedSkill?.trim() || null;
  const lane = args.lane?.trim().toLowerCase() || null;
  const taskType = args.taskType?.trim().toLowerCase() || null;
  const advertisedSkillIds = new Set(args.advertisedSkills);
  const laneCandidates = lane ? (LANE_CANDIDATES[lane] ?? []) : [];
  const taskTypeCandidates = taskType
    ? (TASK_TYPE_CANDIDATES[taskType] ?? [])
    : [];
  const matchedSkillFromDescription =
    matchSkillFromDescription(args.description, args.advertisedSkills) ?? null;

  const candidates = unique([
    ...(providedSkill ? [providedSkill] : []),
    ...laneCandidates,
    ...taskTypeCandidates,
    ...(matchedSkillFromDescription ? [matchedSkillFromDescription] : []),
    "generic-task",
  ]);

  if (providedSkill) {
    return {
      resolvedSkill: providedSkill,
      trace: {
        policyVersion: "v1",
        providedSkill,
        lane,
        taskType,
        strategy: "explicit_skill",
        candidates,
        matchedSkillFromDescription,
        resolvedSkill: providedSkill,
      },
    };
  }

  const fromLane = pickFirstAdvertised(laneCandidates, advertisedSkillIds);
  if (fromLane) {
    return {
      resolvedSkill: fromLane,
      trace: {
        policyVersion: "v1",
        providedSkill,
        lane,
        taskType,
        strategy: "lane_policy",
        candidates,
        matchedSkillFromDescription,
        resolvedSkill: fromLane,
      },
    };
  }

  const fromTaskType = pickFirstAdvertised(
    taskTypeCandidates,
    advertisedSkillIds
  );
  if (fromTaskType) {
    return {
      resolvedSkill: fromTaskType,
      trace: {
        policyVersion: "v1",
        providedSkill,
        lane,
        taskType,
        strategy: "task_type_policy",
        candidates,
        matchedSkillFromDescription,
        resolvedSkill: fromTaskType,
      },
    };
  }

  if (matchedSkillFromDescription) {
    return {
      resolvedSkill: matchedSkillFromDescription,
      trace: {
        policyVersion: "v1",
        providedSkill,
        lane,
        taskType,
        strategy: "description_match",
        candidates,
        matchedSkillFromDescription,
        resolvedSkill: matchedSkillFromDescription,
      },
    };
  }

  return {
    resolvedSkill: "generic-task",
    trace: {
      policyVersion: "v1",
      providedSkill,
      lane,
      taskType,
      strategy: "fallback_generic",
      candidates,
      matchedSkillFromDescription,
      resolvedSkill: "generic-task",
    },
  };
}
