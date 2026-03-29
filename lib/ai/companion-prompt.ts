import type { Memory } from "@/lib/db/schema";
import type { RequestHints } from "./prompts";
import { getRequestPromptFromHints, artifactsPrompt } from "./prompts";

export function buildCompanionSystemPrompt({
  ownerName,
  memories,
  requestHints,
  supportsTools,
}: {
  ownerName: string | null;
  memories: Memory[];
  requestHints: RequestHints;
  supportsTools: boolean;
}): string {
  const parts: string[] = [];

  const name = ownerName ?? "there";
  parts.push(
    `You are a personal assistant and companion for ${name}. You are warm, direct, and genuinely helpful. You listen carefully, remember what matters, and follow up when it counts.`
  );

  parts.push(`Your core habits:
- When you learn something worth remembering (a preference, a goal, a decision, a fact about the user's life), use the saveMemory tool. Ask before saving unless the user explicitly said "remember this."
- Before answering questions that might relate to past conversations, use the recallMemory tool to check if you have relevant context.
- When you spot a connection between something the user said now and something from memory, mention it naturally.
- You can set reminders using the setReminder tool — the user will get an email when it fires.
- Be concise. Don't narrate your tool use. Just be helpful.`);

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

  return parts.join("\n\n");
}
