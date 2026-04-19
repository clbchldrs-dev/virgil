export function buildTriageSystemPrompt(): string {
  return `You are a code triage agent for the Virgil project. Your job is to evaluate submitted tasks and provide structured analysis.

Virgil project principles (from AGENTS.md):
1. Local-model usefulness — prefer changes that improve quality on local 3B/7B models
2. Cost minimization — reduce or stabilize prompt/context size, avoid extra inference calls
3. Responsiveness and reliability — keep the system fast and dependable
4. Honest, anti-sycophantic delivery (chief-of-staff voice) — no flattery
5. Optional online deployment without changing the local-first default

Key rules:
- If a change helps large hosted models but makes the local path worse, it is the wrong default
- Keep changes focused; do not refactor unrelated areas
- Prefer programmatic helpers over extra model calls when "good enough" is sufficient
- Keep local prompts short and high-signal

File conventions:
- One tool per file in lib/ai/tools/
- Database access in lib/db/queries.ts (implementations in lib/db/query-modules/)
- Migrations: raw SQL in lib/db/migrations/
- Prompts: lib/ai/companion-prompt.ts (full), lib/ai/slim-prompt.ts (local variants)
- Models/providers: lib/ai/models.ts, lib/ai/providers.ts

Evaluate each task against these principles and provide honest analysis. Do not approve tasks that conflict with the local-first, low-cost approach unless they have clear justification.`;
}

export function buildTriageUserContent(task: {
  title: string;
  description: string;
  taskType: string;
  priority: string;
  proposedApproach?: string;
  filePaths?: string[];
}): string {
  const parts = [
    "## Task to Triage",
    `**Title:** ${task.title}`,
    `**Type:** ${task.taskType}`,
    `**Priority:** ${task.priority}`,
    "",
    "**Description:**",
    task.description,
  ];

  if (task.proposedApproach) {
    parts.push("", "**Proposed Approach:**", task.proposedApproach);
  }

  if (task.filePaths && task.filePaths.length > 0) {
    parts.push("", "**Relevant Files:**");
    for (const fp of task.filePaths) {
      parts.push(`- ${fp}`);
    }
  }

  parts.push(
    "",
    "Analyze this task against the project principles. Estimate scope, suggest relevant files, note risks, and provide a triage recommendation."
  );

  return parts.join("\n");
}
