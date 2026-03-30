import "server-only";

import { and, desc, eq, inArray } from "drizzle-orm";
import { VirgilError } from "@/lib/errors";
import { db } from "../client";
import { agentTask } from "../schema";

export async function createAgentTask({
  userId,
  chatId,
  taskType,
  title,
  description,
  priority = "medium",
  githubIssueNumber,
  githubIssueUrl,
  metadata,
}: {
  userId: string;
  chatId?: string;
  taskType: "bug" | "feature" | "refactor" | "prompt" | "docs" | "infra";
  title: string;
  description: string;
  priority?: "low" | "medium" | "high" | "critical";
  githubIssueNumber?: number;
  githubIssueUrl?: string;
  metadata?: Record<string, unknown>;
}) {
  try {
    const [row] = await db
      .insert(agentTask)
      .values({
        userId,
        chatId,
        taskType,
        title,
        description,
        priority,
        githubIssueNumber,
        githubIssueUrl,
        metadata: metadata ?? {},
      })
      .returning();
    return row;
  } catch (_error) {
    throw new VirgilError(
      "bad_request:database",
      "Failed to create agent task"
    );
  }
}

export async function listAgentTasks({
  userId,
  status,
  limit = 50,
}: {
  userId: string;
  status?: "submitted" | "approved" | "in_progress" | "done" | "rejected";
  limit?: number;
}) {
  try {
    const condition = status
      ? and(eq(agentTask.userId, userId), eq(agentTask.status, status))
      : eq(agentTask.userId, userId);

    return await db
      .select()
      .from(agentTask)
      .where(condition)
      .orderBy(desc(agentTask.createdAt))
      .limit(limit);
  } catch (_error) {
    throw new VirgilError("bad_request:database", "Failed to list agent tasks");
  }
}

export async function updateAgentTaskStatus({
  id,
  userId,
  status,
  agentNotes,
}: {
  id: string;
  userId: string;
  status: "submitted" | "approved" | "in_progress" | "done" | "rejected";
  agentNotes?: string;
}) {
  try {
    const [row] = await db
      .update(agentTask)
      .set({
        status,
        ...(agentNotes === undefined ? {} : { agentNotes }),
        updatedAt: new Date(),
      })
      .where(and(eq(agentTask.id, id), eq(agentTask.userId, userId)))
      .returning();
    return row ?? null;
  } catch (_error) {
    throw new VirgilError(
      "bad_request:database",
      "Failed to update agent task status"
    );
  }
}

export async function getApprovedTasks({
  limit = 20,
}: {
  limit?: number;
} = {}) {
  try {
    return await db
      .select()
      .from(agentTask)
      .where(inArray(agentTask.status, ["approved", "submitted"]))
      .orderBy(desc(agentTask.priority), desc(agentTask.createdAt))
      .limit(limit);
  } catch (_error) {
    throw new VirgilError(
      "bad_request:database",
      "Failed to get approved agent tasks"
    );
  }
}

export async function getAgentTaskById({ id }: { id: string }) {
  try {
    const rows = await db
      .select()
      .from(agentTask)
      .where(eq(agentTask.id, id))
      .limit(1);
    return rows.at(0) ?? null;
  } catch (_error) {
    throw new VirgilError("bad_request:database", "Failed to get agent task");
  }
}

export async function getSubmittedTasksForTriage({
  limit = 10,
}: {
  limit?: number;
} = {}) {
  try {
    return await db
      .select()
      .from(agentTask)
      .where(eq(agentTask.status, "submitted"))
      .orderBy(desc(agentTask.createdAt))
      .limit(limit);
  } catch (_error) {
    throw new VirgilError(
      "bad_request:database",
      "Failed to get tasks for triage"
    );
  }
}

export async function setAgentTaskTriageNotes({
  id,
  agentNotes,
}: {
  id: string;
  agentNotes: string;
}) {
  try {
    const [row] = await db
      .update(agentTask)
      .set({ agentNotes, updatedAt: new Date() })
      .where(eq(agentTask.id, id))
      .returning();
    return row ?? null;
  } catch (_error) {
    throw new VirgilError(
      "bad_request:database",
      "Failed to set agent task triage notes"
    );
  }
}
