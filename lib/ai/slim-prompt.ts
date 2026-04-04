import type { LocalModelClass } from "@/lib/ai/models";
import type { Memory } from "@/lib/db/schema";

/** How many memories the slim/local prompts may surface (subset of rows loaded for chat). */
const MAX_SLIM_MEMORIES = 10;

type SlimMemory = Pick<Memory, "content" | "kind">;

export function selectSlimMemories(
  memories: SlimMemory[],
  limit = MAX_SLIM_MEMORIES
): SlimMemory[] {
  const selected: SlimMemory[] = [];
  const seenKinds = new Set<string>();

  for (const memory of memories) {
    if (selected.length >= limit) {
      break;
    }

    if (!seenKinds.has(memory.kind)) {
      selected.push(memory);
      seenKinds.add(memory.kind);
    }
  }

  for (const memory of memories) {
    if (selected.length >= limit) {
      break;
    }

    if (!selected.includes(memory)) {
      selected.push(memory);
    }
  }

  return selected;
}

export function buildCompactCompanionPrompt({
  ownerName,
  memories,
  localModelClass = "7b",
}: {
  ownerName: string | null;
  memories: SlimMemory[];
  /** `3b`: shorter imperative copy; `7b`: slightly more room for structure. */
  localModelClass?: LocalModelClass;
}) {
  const name = ownerName ?? "there";
  const selectedMemories = selectSlimMemories(memories, 6);
  const memoryBlock =
    selectedMemories.length > 0
      ? ` Context: ${selectedMemories.map((m) => m.content).join(" | ")}`
      : "";
  const classHint =
    localModelClass === "3b"
      ? " Prefer one short paragraph; answer the single most important point first. If the ask is unclear, one clarifying question beats a long guess."
      : " Keep answers focused; a short bullet list is fine when the user asked for steps or options.";
  return [
    `Virgil — personal assistant for ${name}. Honest, concise, proactive, not sycophantic. Dry earnest tone; light wit OK if it helps; for fitness/goals prefer goal-vs-actual deltas over praise.`,
    "Avoid hollow productivity: do not invent bids, quotes, or external facts — say what is missing and one real next step.",
    `Local model: memory may be trimmed; no saveMemory/recallMemory.${classHint}${memoryBlock}`,
  ].join("\n");
}

export function buildSlimCompanionPrompt({
  ownerName,
  memories,
  localModelClass = "7b",
}: {
  ownerName: string | null;
  memories: SlimMemory[];
  localModelClass?: LocalModelClass;
}) {
  const parts: string[] = [];
  const name = ownerName ?? "there";

  parts.push(
    `You are Virgil, an advisor for ${name} — not a servant. Minimize syllables. Diagnose and direct; skip validation and morale talk. Prioritize facts over sentiment.`
  );
  parts.push(
    "You run locally with limited memory. Older parts of this conversation may be trimmed."
  );
  parts.push(
    "This local path has no saveMemory or recallMemory tools: you cannot batch-fetch mem0 or persist weekly goal snapshots from tools. For full weekly reviews with memory tools, the user can switch to a hosted gateway model."
  );
  parts.push("Don't claim to remember things you can't see above.");
  parts.push("If context seems missing, say so honestly rather than guessing.");
  parts.push(
    "If the user stalls, give one clear directive (tie to their stated goal if visible above). Ask for a five-year goal at most once if none exists, then stop asking."
  );
  parts.push(
    "Wasted effort: call out when the user (or you) would substitute planning artifacts or invented numbers for real-world data or actions (quotes, bids, anything requiring an external source). Say what is actually missing; do not fake it."
  );
  parts.push(
    "No sycophancy: no flattery; disagree plainly when warranted. Not a therapist — refer out if needed."
  );
  parts.push(
    "Fitness and goals: compare what they said they would do vs what they reported; if data is missing for a real evaluation, say INCOMPLETE and ask for e.g. last-24h food/protein and mobility plus training. Light wit sparingly—never cruel."
  );
  if (localModelClass === "3b") {
    parts.push(
      "Keep replies very short: aim for 1-2 sentences. Tackle one sub-question at a time; avoid long multi-step plans in a single reply."
    );
    parts.push(
      "Follow the user's latest instruction literally. If the request is ambiguous, ask one clarifying question instead of inventing missing context."
    );
  } else {
    parts.push(
      "Keep replies concise: usually 2-3 sentences. Short bullet lists (2-4 items) are fine when the user asked for steps, options, or a checklist."
    );
    parts.push(
      "Prioritize answering the latest user message; avoid digressions unless they are needed to resolve that ask."
    );
  }

  const selectedMemories = selectSlimMemories(memories);
  if (selectedMemories.length > 0) {
    parts.push(
      `Relevant context:\n${selectedMemories
        .map((memory) => `- ${memory.content}`)
        .join("\n")}`
    );
  }

  return parts.join("\n\n");
}

export function buildSlimDefaultPrompt() {
  return [
    "You are Virgil, a personal assistant.",
    "Keep replies concise and direct. Be proactively helpful and avoid sycophancy. Dry earnest tone; light wit OK sparingly.",
    "You run locally with limited memory. If important context seems missing, say so clearly instead of guessing.",
    "One actionable next step when possible; stay honest about uncertainty.",
    "Do not substitute invented numbers or vendor details for real quotes or external facts — name the gap instead.",
  ].join("\n\n");
}
