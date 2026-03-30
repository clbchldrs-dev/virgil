import "server-only";

const TRUE = new Set(["1", "true", "yes"]);

export function isAgentTaskTriageEnabled(): boolean {
  const v = process.env.AGENT_TASK_TRIAGE_ENABLED?.toLowerCase().trim();
  return v ? TRUE.has(v) : false;
}

export function getAgentTaskTriageModelId(): string {
  return (
    process.env.AGENT_TASK_TRIAGE_MODEL?.trim() || "ollama/qwen2.5:7b-instruct"
  );
}
