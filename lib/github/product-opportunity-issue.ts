import { createHash } from "node:crypto";

export type ProductOpportunityPayload = {
  title: string;
  problem: string;
  userEvidence: string;
  proposedSlice: string;
  nonGoals: string;
  alignmentLocalFirst: boolean;
  alignmentLowCost: boolean;
  alignmentTestable: string;
  chatId: string;
  /** Short anonymized ref for correlating without PII */
  userRef: string;
};

/**
 * True when GitHub Issues filing is configured (gateway-only tool; see AGENTS.md).
 */
export function isProductOpportunityConfigured(): boolean {
  const token = getToken();
  const repo = process.env.GITHUB_REPOSITORY?.trim();
  return Boolean(token && repo?.includes("/") && repo.split("/").length === 2);
}

function getToken(): string | undefined {
  return (
    process.env.GITHUB_PRODUCT_OPPORTUNITY_TOKEN?.trim() ||
    process.env.GITHUB_TOKEN?.trim()
  );
}

export function formatIssueBody(payload: ProductOpportunityPayload): string {
  const lines = [
    "## Problem",
    payload.problem.trim(),
    "",
    "## User / conversation signal",
    payload.userEvidence.trim(),
    "",
    "## Proposed slice (smallest useful change)",
    payload.proposedSlice.trim(),
    "",
    "## Non-goals (what this is not)",
    payload.nonGoals.trim(),
    "",
    "## Alignment (Virgil: local-first, low cost, testable)",
    `- **Local-first / helpful on small models:** ${payload.alignmentLocalFirst ? "Yes" : "No — needs owner review"}`,
    `- **Keeps recurring cost flat:** ${payload.alignmentLowCost ? "Yes" : "No — needs owner review"}`,
    `- **Test / verify:** ${payload.alignmentTestable.trim()}`,
    "",
    "## Meta",
    `- chatId: \`${payload.chatId}\``,
    `- userRef: \`${payload.userRef}\` (anonymized)`,
    "",
    "---",
    "Submitted via Virgil `submitProductOpportunity` tool (gateway models). Owner triage: add label `approved-for-build` or close.",
  ];
  return lines.join("\n");
}

export type CreateIssueResult = { htmlUrl: string; number: number };

/**
 * Opens a GitHub Issue in `GITHUB_REPOSITORY` using a PAT with `issues: write`.
 * If label application fails (unknown labels), retries once without labels.
 */
export async function createProductOpportunityIssue(
  payload: ProductOpportunityPayload
): Promise<CreateIssueResult> {
  const token = getToken();
  const repo = process.env.GITHUB_REPOSITORY?.trim();
  if (!token || !repo?.includes("/")) {
    throw new Error("GitHub product opportunity is not configured");
  }

  const [owner, repoName] = repo.split("/");
  if (!owner || !repoName) {
    throw new Error("GITHUB_REPOSITORY must be owner/repo");
  }

  const labelStr = process.env.GITHUB_PRODUCT_OPPORTUNITY_LABELS?.trim();
  const labels =
    labelStr && labelStr.length > 0
      ? labelStr
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean)
      : ["product-opportunity", "needs-owner-decision"];

  const title = `[Virgil] ${payload.title}`.slice(0, 200);
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

/**
 * Maps GitHub API errors to short, operator-safe strings for the chat tool result
 * (avoids echoing JSON bodies or tokens to the model/user).
 */
export function sanitizeProductOpportunityToolError(error: unknown): string {
  if (!(error instanceof Error)) {
    return "Could not create the GitHub issue. Please try again later.";
  }
  const m = error.message;
  if (m === "GitHub product opportunity is not configured") {
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
