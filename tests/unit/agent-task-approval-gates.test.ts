import assert from "node:assert/strict";
import test from "node:test";
import { getAgentTaskApprovalBlockMessage } from "@/lib/agent-tasks/approval-gates";
import type { AgentTask } from "@/lib/db/schema";

function baseTask(over: Partial<AgentTask>): AgentTask {
  return {
    id: "00000000-0000-4000-8000-000000000001",
    userId: "00000000-0000-4000-8000-000000000002",
    chatId: null,
    taskType: "prompt",
    title: "Test task",
    description: "Desc",
    priority: "medium",
    status: "submitted",
    githubIssueNumber: null,
    githubIssueUrl: null,
    agentNotes: null,
    metadata: {},
    createdAt: new Date(),
    updatedAt: new Date(),
    ...over,
  };
}

test("standard task never blocked for approval", () => {
  const m = getAgentTaskApprovalBlockMessage(baseTask({ taskType: "prompt" }), {
    nextStatus: "approved",
    githubAgentTasksConfigured: true,
    outOfBandReviewAcknowledged: false,
  });
  assert.equal(m, null);
});

test("elevated + GitHub configured blocks without issue URL", () => {
  const m = getAgentTaskApprovalBlockMessage(
    baseTask({ taskType: "infra", priority: "low" }),
    {
      nextStatus: "approved",
      githubAgentTasksConfigured: true,
      outOfBandReviewAcknowledged: false,
    }
  );
  assert.ok(m && m.includes("GitHub"));
});

test("elevated + GitHub configured allows when issue URL present", () => {
  const m = getAgentTaskApprovalBlockMessage(
    baseTask({
      taskType: "infra",
      githubIssueUrl: "https://github.com/o/r/issues/1",
    }),
    {
      nextStatus: "approved",
      githubAgentTasksConfigured: true,
      outOfBandReviewAcknowledged: false,
    }
  );
  assert.equal(m, null);
});

test("elevated + no GitHub blocks without ack", () => {
  const m = getAgentTaskApprovalBlockMessage(
    baseTask({ taskType: "infra", priority: "low" }),
    {
      nextStatus: "approved",
      githubAgentTasksConfigured: false,
      outOfBandReviewAcknowledged: false,
    }
  );
  assert.ok(m && m.includes("out-of-band"));
});

test("elevated + no GitHub allows with body ack", () => {
  const m = getAgentTaskApprovalBlockMessage(
    baseTask({ taskType: "infra", priority: "low" }),
    {
      nextStatus: "approved",
      githubAgentTasksConfigured: false,
      outOfBandReviewAcknowledged: true,
    }
  );
  assert.equal(m, null);
});
