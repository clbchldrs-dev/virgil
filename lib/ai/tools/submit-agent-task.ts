import { tool } from "ai";
import { z } from "zod";
import { virgilLaneIdSchema } from "@/lib/ai/lanes";
import { createAgentTask } from "@/lib/db/queries";
import {
  anonymizedUserRef,
  createAgentTaskIssue,
  isAgentTaskGitHubConfigured,
  sanitizeAgentTaskToolError,
} from "@/lib/github/agent-task-issue";

/**
 * Gateway-only: creates a structured task for Cursor or background agents
 * to pick up. Optionally opens a GitHub Issue for tracking.
 */
export function submitAgentTask({
  userId,
  chatId,
  allowed,
}: {
  userId: string;
  chatId: string;
  allowed: boolean;
}) {
  return tool({
    description:
      "Queue an improvement, bug fix, refactor, or other task for Virgil itself. " +
      "Creates a trackable task in the database and optionally a GitHub Issue. " +
      "Use when the user wants to submit a specific improvement for Cursor or background agents to implement. " +
      "Confirm the task description with the user before calling.",
    inputSchema: z.object({
      title: z.string().min(8).max(120).describe("Short actionable task title"),
      description: z
        .string()
        .min(20)
        .describe("Full problem statement and what needs to change"),
      taskType: z.enum([
        "bug",
        "feature",
        "refactor",
        "prompt",
        "docs",
        "infra",
      ]),
      priority: z.enum(["low", "medium", "high", "critical"]).default("medium"),
      proposedApproach: z
        .string()
        .optional()
        .describe("How an agent should approach the fix or implementation"),
      filePaths: z
        .array(z.string())
        .optional()
        .describe("Files likely relevant to this task"),
      lane: virgilLaneIdSchema
        .optional()
        .describe(
          "Delegation lane — use **code** (default for repo work) unless the task is clearly another lane"
        ),
    }),
    needsApproval: true,
    execute: async (input) => {
      if (!allowed) {
        return {
          success: false as const,
          message: "Agent task submissions are not available in this context.",
        };
      }

      try {
        const githubConfigured = isAgentTaskGitHubConfigured();
        let githubIssueNumber: number | undefined;
        let githubIssueUrl: string | undefined;

        if (githubConfigured) {
          try {
            const issue = await createAgentTaskIssue({
              title: input.title,
              description: input.description,
              taskType: input.taskType,
              priority: input.priority,
              proposedApproach: input.proposedApproach,
              filePaths: input.filePaths,
              chatId,
              userRef: anonymizedUserRef(userId),
            });
            githubIssueNumber = issue.number;
            githubIssueUrl = issue.htmlUrl;
          } catch (ghError) {
            const msg = sanitizeAgentTaskToolError(ghError);
            return {
              success: false as const,
              message: `Task not saved — GitHub issue creation failed: ${msg}`,
            };
          }
        }

        const lane = input.lane ?? "code";
        const task = await createAgentTask({
          userId,
          chatId,
          taskType: input.taskType,
          title: input.title,
          description: input.description,
          priority: input.priority,
          githubIssueNumber,
          githubIssueUrl,
          metadata: {
            proposedApproach: input.proposedApproach,
            filePaths: input.filePaths,
            lane,
          },
        });

        const parts = [`Task created (id: ${task.id})`];
        if (githubIssueUrl) {
          parts.push(`GitHub issue: ${githubIssueUrl}`);
        }
        parts.push(
          "Status: submitted. The owner can approve it for Cursor or background agents to pick up."
        );

        return {
          success: true as const,
          taskId: task.id,
          issueNumber: githubIssueNumber,
          issueUrl: githubIssueUrl,
          message: parts.join(". "),
        };
      } catch (e) {
        const fallback =
          e instanceof Error ? e.message : "Unknown error creating task";
        return {
          success: false as const,
          message: `Failed to create agent task: ${fallback}`,
        };
      }
    },
  });
}
