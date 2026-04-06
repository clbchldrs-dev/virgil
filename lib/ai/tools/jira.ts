import { tool } from "ai";
import { z } from "zod";

/** True when server env has all three Jira Cloud REST credentials (trimmed non-empty). */
export function isJiraConfigured(): boolean {
  const baseUrl = process.env.JIRA_BASE_URL?.trim();
  const email = process.env.JIRA_EMAIL?.trim();
  const token = process.env.JIRA_API_TOKEN?.trim();
  return Boolean(baseUrl && email && token);
}

async function jiraFetch(path: string, options?: RequestInit) {
  const baseUrl = process.env.JIRA_BASE_URL;
  const email = process.env.JIRA_EMAIL;
  const token = process.env.JIRA_API_TOKEN;

  if (!isJiraConfigured()) {
    throw new Error("Jira credentials not configured");
  }

  const res = await fetch(`${baseUrl}/rest/api/3${path}`, {
    ...options,
    headers: {
      Authorization: `Basic ${Buffer.from(`${email}:${token}`).toString("base64")}`,
      "Content-Type": "application/json",
      ...options?.headers,
    },
  });

  if (!res.ok) {
    throw new Error(`Jira API error: ${res.status} ${await res.text()}`);
  }

  return res.json();
}

export const getJiraIssue = tool({
  description: "Get details of a Jira issue by key (e.g., PROJ-123).",
  inputSchema: z.object({
    issueKey: z.string().describe("Jira issue key like PROJ-123"),
  }),
  execute: async ({ issueKey }) => {
    try {
      const data = await jiraFetch(`/issue/${issueKey}`);
      return {
        key: data.key,
        summary: data.fields.summary,
        status: data.fields.status.name,
        assignee: data.fields.assignee?.displayName ?? "Unassigned",
        description: data.fields.description,
        priority: data.fields.priority?.name,
      };
    } catch (err: unknown) {
      return { error: err instanceof Error ? err.message : String(err) };
    }
  },
});

export const searchJiraIssues = tool({
  description: "Search Jira issues using JQL query.",
  inputSchema: z.object({
    jql: z.string().describe("JQL query string"),
    maxResults: z.number().optional().default(10),
  }),
  execute: async ({ jql, maxResults }) => {
    try {
      const data = await jiraFetch(
        `/search?jql=${encodeURIComponent(jql)}&maxResults=${maxResults}`
      );
      return {
        total: data.total,
        issues: data.issues.map(
          (issue: {
            key: string;
            fields: {
              summary: string;
              status: { name: string };
              assignee: { displayName: string } | null;
            };
          }) => ({
            key: issue.key,
            summary: issue.fields.summary,
            status: issue.fields.status.name,
            assignee: issue.fields.assignee?.displayName ?? "Unassigned",
          })
        ),
      };
    } catch (err: unknown) {
      return { error: err instanceof Error ? err.message : String(err) };
    }
  },
});

export const updateJiraIssue = tool({
  description: "Update a Jira issue. Can change the summary or add a comment.",
  inputSchema: z.object({
    issueKey: z.string().describe("Jira issue key"),
    summary: z.string().optional().describe("New summary/title"),
    comment: z.string().optional().describe("Comment to add"),
  }),
  execute: async ({ issueKey, summary, comment }) => {
    try {
      if (summary) {
        await jiraFetch(`/issue/${issueKey}`, {
          method: "PUT",
          body: JSON.stringify({ fields: { summary } }),
        });
      }
      if (comment) {
        await jiraFetch(`/issue/${issueKey}/comment`, {
          method: "POST",
          body: JSON.stringify({
            body: {
              type: "doc",
              version: 1,
              content: [
                {
                  type: "paragraph",
                  content: [{ type: "text", text: comment }],
                },
              ],
            },
          }),
        });
      }
      return { success: true, issueKey };
    } catch (err: unknown) {
      return { error: err instanceof Error ? err.message : String(err) };
    }
  },
});
