import type { JSONObject } from "@ai-sdk/provider";
import { generateText, type ModelMessage } from "ai";
import { isLocalModel } from "@/lib/ai/models";
import type { OllamaLanguageModelOptions } from "@/lib/ai/providers";
import { getLanguageModel } from "@/lib/ai/providers";
import { VIRGIL_SYSTEM_PERSONA_DIVIDER } from "@/lib/ai/virgil-system-markers";
import { isProductionEnvironment } from "@/lib/constants";
import { buildPlannerSystemPrompt } from "./planner-prompt";

const DEFAULT_PLANNER_MAX_OUTPUT_TOKENS = 384;
const USER_SNIPPET_MAX_CHARS = 12_000;

/** One planner stage: model id and output budget (“size”). */
export type VirgilPlannerStage = {
  modelId: string;
  maxOutputTokens: number;
};

export function isVirgilMultiAgentEnabled(): boolean {
  const v = process.env.VIRGIL_MULTI_AGENT_ENABLED?.trim().toLowerCase();
  return v === "1" || v === "true" || v === "yes";
}

export function getPlannerModelId(chatModel: string): string {
  const override = process.env.VIRGIL_MULTI_AGENT_PLANNER_MODEL?.trim();
  if (override && override.length > 0) {
    return override;
  }
  return chatModel;
}

function parseCommaSeparatedTokens(raw: string | undefined): string[] {
  if (!raw?.trim()) {
    return [];
  }
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

function parseStageMaxOutputTokens(
  raw: string | undefined,
  stageCount: number,
  fallbackPerStage: number
): number[] {
  if (stageCount <= 0) {
    return [];
  }
  if (!raw?.trim()) {
    return Array.from({ length: stageCount }, () => fallbackPerStage);
  }
  const parts = parseCommaSeparatedTokens(raw);
  if (parts.length === 1) {
    const n = Number.parseInt(parts[0]!, 10);
    const v =
      Number.isFinite(n) && n > 0 ? Math.min(n, 4096) : fallbackPerStage;
    return Array.from({ length: stageCount }, () => v);
  }
  const nums = parts.map((p) => {
    const n = Number.parseInt(p, 10);
    return Number.isFinite(n) && n > 0 ? Math.min(n, 4096) : fallbackPerStage;
  });
  const out: number[] = [];
  for (let i = 0; i < stageCount; i++) {
    out.push(nums[i] ?? nums[nums.length - 1] ?? fallbackPerStage);
  }
  return out;
}

/**
 * Resolves ordered planner stages from env: chain of models and per-stage token caps.
 * When `VIRGIL_MULTI_AGENT_PLANNER_CHAIN` is unset, uses a single stage from
 * `getPlannerModelId(chatModel)` (legacy behavior).
 */
export function resolvePlannerStages(chatModel: string): VirgilPlannerStage[] {
  const chainModels = parseCommaSeparatedTokens(
    process.env.VIRGIL_MULTI_AGENT_PLANNER_CHAIN?.trim()
  );
  const defaultCapRaw = process.env.VIRGIL_MULTI_AGENT_PLANNER_MAX_OUTPUT_TOKENS_DEFAULT?.trim();
  const defaultCap = Number.parseInt(
    defaultCapRaw ?? String(DEFAULT_PLANNER_MAX_OUTPUT_TOKENS),
    10
  );
  const fallbackPerStage =
    Number.isFinite(defaultCap) && defaultCap > 0
      ? Math.min(defaultCap, 4096)
      : DEFAULT_PLANNER_MAX_OUTPUT_TOKENS;

  const modelIds =
    chainModels.length > 0 ? chainModels : [getPlannerModelId(chatModel)];

  const maxTokens = parseStageMaxOutputTokens(
    process.env.VIRGIL_MULTI_AGENT_PLANNER_STAGE_MAX_TOKENS?.trim(),
    modelIds.length,
    fallbackPerStage
  );

  return modelIds.map((modelId, i) => ({
    modelId,
    maxOutputTokens: maxTokens[i]!,
  }));
}

export function mergePlannerOutlineIntoSystemPrompt(
  baseSystem: string,
  outline: string
): string {
  const trimmed = outline.trim();
  if (!trimmed) {
    return baseSystem;
  }
  const dividerIdx = baseSystem.indexOf(VIRGIL_SYSTEM_PERSONA_DIVIDER);
  if (dividerIdx === -1) {
    return `${baseSystem}

---
Executor outline (follow this plan; do not dump it verbatim unless it helps the user):
${trimmed}
---`;
  }
  const head = baseSystem.slice(
    0,
    dividerIdx + VIRGIL_SYSTEM_PERSONA_DIVIDER.length
  );
  const sessionAndTools = baseSystem.slice(
    dividerIdx + VIRGIL_SYSTEM_PERSONA_DIVIDER.length
  );
  return `${head}
---
Executor outline (follow this plan; do not dump it verbatim unless it helps the user):
${trimmed}
---

${sessionAndTools}`;
}

function textFromUserContent(content: ModelMessage["content"]): string {
  if (typeof content === "string") {
    return content;
  }
  if (!Array.isArray(content)) {
    return "";
  }
  const parts: string[] = [];
  for (const part of content) {
    if (
      part &&
      typeof part === "object" &&
      "type" in part &&
      part.type === "text" &&
      "text" in part &&
      typeof part.text === "string"
    ) {
      parts.push(part.text);
    }
  }
  return parts.join("\n");
}

export function getLastUserTurnSnippet(messages: ModelMessage[]): string {
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i];
    if (m.role !== "user") {
      continue;
    }
    const text = textFromUserContent(m.content).trim();
    if (text.length > 0) {
      return text.length > USER_SNIPPET_MAX_CHARS
        ? `${text.slice(0, USER_SNIPPET_MAX_CHARS)}…`
        : text;
    }
  }
  return "";
}

export async function runPlannerChain({
  stages,
  userMessages,
  ollamaLanguageOptions,
  resolveOllamaLanguageOptionsForPlanner,
  providerOptions,
}: {
  stages: VirgilPlannerStage[];
  userMessages: ModelMessage[];
  /** Used when {@link resolveOllamaLanguageOptionsForPlanner} is omitted (single-model callers). */
  ollamaLanguageOptions?: OllamaLanguageModelOptions;
  /** Per-stage Ollama options (required for mixed local + gateway planner chains). */
  resolveOllamaLanguageOptionsForPlanner?: (
    plannerModelId: string
  ) => OllamaLanguageModelOptions | undefined;
  /** Gateway / OpenAI-compatible options (JSON-serializable values per provider key). */
  providerOptions?: Record<string, JSONObject>;
}): Promise<string> {
  const userSnippet = getLastUserTurnSnippet(userMessages);
  if (!userSnippet || stages.length === 0) {
    return "";
  }

  const total = stages.length;
  let accumulated = "";

  for (let i = 0; i < total; i++) {
    const stage = stages[i]!;
    const ollamaOpts =
      resolveOllamaLanguageOptionsForPlanner?.(stage.modelId) ??
      ollamaLanguageOptions;
    const model = getLanguageModel(stage.modelId, ollamaOpts);

    const userContent =
      i === 0
        ? userSnippet
        : [
            "Original user message:",
            userSnippet,
            "",
            "Prior planner outline (refine; keep constraints aligned with the user message):",
            accumulated,
          ].join("\n");

    const { text } = await generateText({
      model,
      system: buildPlannerSystemPrompt(i, total),
      messages: [{ role: "user", content: userContent }],
      maxOutputTokens: stage.maxOutputTokens,
      experimental_telemetry: {
        isEnabled: isProductionEnvironment,
        functionId:
          total > 1 ? `virgil-planner-stage-${i + 1}-of-${total}` : "virgil-planner",
      },
      ...(providerOptions && Object.keys(providerOptions).length > 0
        ? { providerOptions }
        : {}),
    });

    accumulated = text.trim();
    if (!accumulated) {
      return "";
    }
  }

  return accumulated;
}

/**
 * Single-stage planner outline (compat helper). Prefer {@link resolvePlannerStages} +
 * {@link runPlannerChain} for multi-model / multi-pass orchestration.
 */
export async function runPlannerOutline({
  plannerModelId,
  userMessages,
  ollamaLanguageOptions,
  providerOptions,
}: {
  plannerModelId: string;
  userMessages: ModelMessage[];
  ollamaLanguageOptions?: OllamaLanguageModelOptions;
  providerOptions?: Record<string, JSONObject>;
}): Promise<string> {
  return runPlannerChain({
    stages: [
      {
        modelId: plannerModelId,
        maxOutputTokens: DEFAULT_PLANNER_MAX_OUTPUT_TOKENS,
      },
    ],
    userMessages,
    ollamaLanguageOptions,
    providerOptions,
  });
}

export function isPlannerModelLocal(plannerModelId: string): boolean {
  return isLocalModel(plannerModelId);
}
