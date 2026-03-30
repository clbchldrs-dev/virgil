import { createHash } from "node:crypto";

export type AgentTaskIssuePayload = {
  title: string;
  description: string;
  taskType: "bug" | "feature" | "refactor" | "prompt" | "docs" | "infra";
  priority: "low" | "medium" | "high" | "critical";
  proposedApproach?: string;
  filePaths?: string[];
  chatId?: string;
  userRef: string;
};

function getToken(): string | undefined {
  return (
    process.env.GITHUB_PRODUCT_OPPORTUNITY_TOKEN?.trim() ||
    process.env.GITHUB_TOKEN?.trim()
  );
}

export function isAgentTaskGitHubConfigured(): boolean {
  const token = getToken();
  const repo = process.env.GITHUB_REPOSITORY?.trim();
  return Boolean(token && repo?.includes("/") && repo.split("/").length === 2);
}

function formatIssueBody(payload: AgentTaskIssuePayload): string {
  const lines = [
    "## Problem / Description",
    payload.description.trim(),
    "",
    "## Task Type",
    `\`${payload.taskType}\``,
    "",
    "## Priority",
    `\`${payload.priority}\``,
  ];

  if (payload.proposedApproach) {
    lines.push("", "## Proposed Approach", payload.proposedApproach.trim());
  }

  if (payload.filePaths && payload.filePaths.length > 0) {
    lines.push("", "## Relevant Files");
    for (const fp of payload.filePaths) {
      lines.push(`- \`${fp}\``);
    }
  }

  lines.push(
    "",
    "## Meta",
    `- userRef: \`${payload.userRef}\` (anonymized)`,
    ...(payload.chatId ? [`- chatId: \`${payload.chatId}\``] : []),
    "",
    "---",
    "Submitted via Virgil `submitAgentTask` tool (gateway models). Owner triage: add label `approved-for-build` or close."
  );

  return lines.join("\n");
}

export type CreateIssueResult = { htmlUrl: string; number: number };

export async function createAgentTaskIssue(
  payload: AgentTaskIssuePayload
): Promise<CreateIssueResult> {
  const token = getToken();
  const repo = process.env.GITHUB_REPOSITORY?.trim();
  if (!token || !repo?.includes("/")) {
    throw new Error("GitHub agent task issue creation is not configured");
  }

  const [owner, repoName] = repo.split("/");
  if (!owner || !repoName) {
    throw new Error("GITHUB_REPOSITORY must be owner/repo");
  }

  const labels = ["agent-task", payload.taskType];
  const title = `[Virgil Task] ${payload.title}`.slice(0, 200);
  const body = formatIssueBody(payload);

  const attempt = async (withLabels: boolean) =>
    fetch(`https://api.github.com/repos/${owner}/${repoName}/issues`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
      },
      body: JSON.stringify({
        title,
        body,
        ...(withLabels && labels.length > 0 ? { labels } : {}),
      }),
    });

  let res = await attempt(true);
  if (!res.ok) {
    const errText = await res.text();
    if (res.status === 422 && labels.length > 0 && /label/i.test(errText)) {
      res = await attempt(false);
    } else {
      throw new Error(`GitHub API ${res.status}: ${errText.slice(0, 800)}`);
    }
  }

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`GitHub API ${res.status}: ${errText.slice(0, 800)}`);
  }

  const json = (await res.json()) as { html_url: string; number: number };
  return { htmlUrl: json.html_url, number: json.number };
}

export function anonymizedUserRef(userId: string): string {
  return createHash("sha256").update(userId).digest("hex").slice(0, 12);
}

export function sanitizeAgentTaskToolError(error: unknown): string {
  if (!(error instanceof Error)) {
    return "Could not create the GitHub issue. Please try again later.";
  }
  const m = error.message;
  if (m === "GitHub agent task issue creation is not configured") {
    return m;
  }
  if (m.startsWith("GITHUB_REPOSITORY must be")) {
    return "GitHub is not configured correctly (repository). Check GITHUB_REPOSITORY.";
  }
  const api = /^GitHub API (\d{3}):/u.exec(m);
  if (api) {
    const code = api[1];
    if (code === "401" || code === "403") {
      return "GitHub rejected the request (authentication). Check the token and repository access.";
    }
    if (code === "404") {
      return "GitHub repository not found. Check GITHUB_REPOSITORY.";
    }
    if (code === "422") {
      return "GitHub rejected the issue (validation). Labels or payload may need adjustment.";
    }
    return `Could not create the GitHub issue (error ${code}). Try again later.`;
  }
  return "Could not create the GitHub issue. Please try again later.";
}
