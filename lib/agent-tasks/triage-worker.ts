import "server-only";

import { generateObject } from "ai";
import { getChatModel, isLocalModel } from "@/lib/ai/models";
import { assertOllamaReachable, getLanguageModel } from "@/lib/ai/providers";
import {
  getSubmittedTasksForTriage,
  setAgentTaskTriageNotes,
} from "@/lib/db/queries";
import { getAgentTaskTriageModelId } from "./config";
import { agentTaskTriageOutputSchema } from "./schema";
import {
  buildTriageSystemPrompt,
  buildTriageUserContent,
} from "./triage-prompt";

export type TriageResult = {
  triaged: number;
  errors: number;
  taskIds: string[];
};

export async function runAgentTaskTriage(): Promise<TriageResult> {
  const tasks = await getSubmittedTasksForTriage({ limit: 10 });

  if (tasks.length === 0) {
    return { triaged: 0, errors: 0, taskIds: [] };
  }

  const modelId = getAgentTaskTriageModelId();

  if (isLocalModel(modelId)) {
    await assertOllamaReachable();
  }

  const chatModel = getChatModel(modelId);
  const model = getLanguageModel(modelId, chatModel?.ollamaOptions);
  const system = buildTriageSystemPrompt();

  let triaged = 0;
  let errors = 0;
  const taskIds: string[] = [];

  for (const task of tasks) {
    try {
      const metadata = (task.metadata ?? {}) as Record<string, unknown>;
      const userContent = buildTriageUserContent({
        title: task.title,
        description: task.description,
        taskType: task.taskType,
        priority: task.priority,
        proposedApproach: metadata.proposedApproach as string | undefined,
        filePaths: metadata.filePaths as string[] | undefined,
      });

      const { object } = await generateObject({
        model,
        schema: agentTaskTriageOutputSchema,
        system,
        prompt: userContent,
        maxOutputTokens: 1024,
      });

      const signalLabel: Record<string, string> = {
        well_aligned: "Well aligned (advisory)",
        needs_discussion: "Needs discussion (advisory)",
        principle_conflict: "Principle conflict (advisory)",
      };
      const notes = [
        "## Triage Analysis",
        `**Triage signal:** ${signalLabel[object.recommendation] ?? object.recommendation}`,
        `**Aligns with principles:** ${object.alignsWithPrinciples ? "Yes" : "No"}`,
        `**Scope:** ${object.estimatedScope}`,
        "",
        object.alignmentNotes,
        "",
        object.summary,
      ];

      if (object.suggestedFiles.length > 0) {
        notes.push("", "**Suggested files:**");
        for (const f of object.suggestedFiles) {
          notes.push(`- ${f}`);
        }
      }

      if (object.riskNotes) {
        notes.push("", `**Risks:** ${object.riskNotes}`);
      }

      await setAgentTaskTriageNotes({
        id: task.id,
        agentNotes: notes.join("\n"),
      });

      triaged += 1;
      taskIds.push(task.id);
    } catch (error) {
      console.error(`Agent task triage failed for ${task.id}:`, error);
      errors += 1;
    }
  }

  return { triaged, errors, taskIds };
}
