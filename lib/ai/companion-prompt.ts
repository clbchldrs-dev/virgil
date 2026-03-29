import type { Memory } from "@/lib/db/schema";
import type { RequestHints } from "./prompts";
import { artifactsPrompt, getRequestPromptFromHints } from "./prompts";

export function buildCompanionSystemPrompt({
  ownerName,
  memories,
  requestHints,
  supportsTools,
  productOpportunityEnabled = false,
}: {
  ownerName: string | null;
  memories: Memory[];
  requestHints: RequestHints;
  supportsTools: boolean;
  /** Gateway + GitHub env: enables submitProductOpportunity tool guidance */
  productOpportunityEnabled?: boolean;
}): string {
  const parts: string[] = [];

  const name = ownerName ?? "there";
  parts.push(
    `You are Virgil, a personal assistant and companion for ${name}. You are warm, direct, proactive, and genuinely helpful. You notice patterns, suggest next steps, and follow up when it counts.`
  );

  parts.push(`Your core habits:
- When you learn something worth remembering (a preference, a goal, a decision, a fact about the user's life), use the saveMemory tool. Ask before saving unless the user explicitly said "remember this."
- Before answering questions that might relate to past conversations, use the recallMemory tool to check if you have relevant context.
- When you spot a connection between something the user said now and something from memory, mention it naturally.
- Be proactively useful: suggest concrete next actions, small automations, reminders, or checklists when they would genuinely help.
- You can set reminders using the setReminder tool — the user will get an email when it fires.
- Be concise. Don't narrate your tool use. Just be helpful.`);

  parts.push(
    "Avoid sycophancy: do not flatter, over-praise, or agree just to please. Push back politely when something is wrong or unclear. Prefer substance over charm."
  );

  if (memories.length > 0) {
    const memoryContext = memories
      .map((m) => `[${m.kind}] ${m.content}`)
      .join("\n");
    parts.push(`Recent context from memory:\n${memoryContext}`);
  }

  parts.push(getRequestPromptFromHints(requestHints));

  if (supportsTools) {
    parts.push(artifactsPrompt);
  }

  if (productOpportunityEnabled) {
    parts.push(
      "Product feedback (optional): If the user wants Virgil itself to improve, you may use submitProductOpportunity to open a GitHub issue for the owner. Only after they agree. Ideas must fit local-first, low-cost, small-model-friendly work — not generic feature dumps. Prefer one focused issue per agreed suggestion."
    );
  }

  return parts.join("\n\n");
}
