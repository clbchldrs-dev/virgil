import type { JSONObject } from "@ai-sdk/provider";
import { generateText, type ModelMessage } from "ai";
import { isLocalModel } from "@/lib/ai/models";
import type { OllamaLanguageModelOptions } from "@/lib/ai/providers";
import { getLanguageModel } from "@/lib/ai/providers";
import { isProductionEnvironment } from "@/lib/constants";
import { buildPlannerSystemPrompt } from "./planner-prompt";

const PLANNER_MAX_OUTPUT_TOKENS = 384;
const USER_SNIPPET_MAX_CHARS = 12_000;

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

export function mergePlannerOutlineIntoSystemPrompt(
  baseSystem: string,
  outline: string
): string {
  const trimmed = outline.trim();
  if (!trimmed) {
    return baseSystem;
  }
  return `${baseSystem}

---
Executor outline (follow this plan; do not dump it verbatim unless it helps the user):
${trimmed}
---`;
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

export async function runPlannerOutline({
  plannerModelId,
  userMessages,
  ollamaLanguageOptions,
  providerOptions,
}: {
  plannerModelId: string;
  userMessages: ModelMessage[];
  ollamaLanguageOptions?: OllamaLanguageModelOptions;
  /** Gateway / OpenAI-compatible options (JSON-serializable values per provider key). */
  providerOptions?: Record<string, JSONObject>;
}): Promise<string> {
  const userSnippet = getLastUserTurnSnippet(userMessages);
  if (!userSnippet) {
    return "";
  }

  const model = getLanguageModel(plannerModelId, ollamaLanguageOptions);

  const { text } = await generateText({
    model,
    system: buildPlannerSystemPrompt(),
    messages: [{ role: "user", content: userSnippet }],
    maxOutputTokens: PLANNER_MAX_OUTPUT_TOKENS,
    experimental_telemetry: {
      isEnabled: isProductionEnvironment,
      functionId: "virgil-planner",
    },
    ...(providerOptions && Object.keys(providerOptions).length > 0
      ? { providerOptions }
      : {}),
  });

  return text.trim();
}

export function isPlannerModelLocal(plannerModelId: string): boolean {
  return isLocalModel(plannerModelId);
}
