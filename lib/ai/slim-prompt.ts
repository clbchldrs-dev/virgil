import type { LocalModelClass } from "@/lib/ai/models";
import type { BusinessProfile, Memory } from "@/lib/db/schema";

const MAX_SLIM_MEMORIES = 5;
const MAX_PRIORITY_NOTE_WORDS = 50;

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
  const selectedMemories = selectSlimMemories(memories, 3);
  const memoryBlock =
    selectedMemories.length > 0
      ? ` Context: ${selectedMemories.map((m) => m.content).join(" | ")}`
      : "";
  const classHint =
    localModelClass === "3b"
      ? " Prefer one short paragraph; answer the single most important point first."
      : " Keep answers focused; a short list is fine when it helps.";
  return [
    `Virgil — personal assistant for ${name}. Honest, concise, proactive, not sycophantic.`,
    `Local model: memory may be trimmed.${classHint}${memoryBlock}`,
  ].join("\n");
}

export function buildCompactFrontDeskPrompt({
  profile,
  priorityNote,
  localModelClass = "7b",
}: {
  profile: Pick<
    BusinessProfile,
    | "businessName"
    | "tonePreference"
    | "industry"
    | "hoursOfOperation"
    | "services"
    | "neverPromise"
  >;
  priorityNote?: string | null;
  localModelClass?: LocalModelClass;
}) {
  const classHint =
    localModelClass === "3b"
      ? "One customer-facing move per reply (answer or one short question)."
      : "Be brief; a short next step is OK when needed.";
  const bits = [
    `Front desk for ${profile.businessName}. Tone: ${profile.tonePreference}. No flattery. ${classHint}`,
    profile.neverPromise.length > 0
      ? `Never promise: ${profile.neverPromise.join(", ")}.`
      : null,
    priorityNote && shouldIncludePriorityNote(priorityNote)
      ? `Note: ${priorityNote}`
      : null,
  ].filter(Boolean);
  return bits.join("\n");
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
    `You are Virgil, a personal assistant for ${name}. Warm, direct, helpful, proactive.`
  );
  parts.push(
    "You run locally with limited memory. Older parts of this conversation may be trimmed."
  );
  parts.push("Don't claim to remember things you can't see above.");
  parts.push("If context seems missing, say so honestly rather than guessing.");
  parts.push(
    "Be proactively useful: suggest the next helpful action when it is obvious."
  );
  parts.push(
    "No sycophancy: skip flattery and empty praise; disagree or correct when appropriate in a brief, respectful way."
  );
  if (localModelClass === "3b") {
    parts.push(
      "Keep replies very short: aim for 1-2 sentences. Tackle one sub-question at a time; avoid long multi-step plans in a single reply."
    );
  } else {
    parts.push("Keep replies concise: usually 2-3 sentences.");
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

export function buildSlimFrontDeskPrompt({
  profile,
  priorityNote,
  localModelClass = "7b",
}: {
  profile: Pick<
    BusinessProfile,
    | "businessName"
    | "tonePreference"
    | "industry"
    | "hoursOfOperation"
    | "services"
    | "neverPromise"
  >;
  priorityNote?: string | null;
  localModelClass?: LocalModelClass;
}) {
  const parts: string[] = [];

  parts.push(
    `You are Virgil, acting as the front desk assistant for ${profile.businessName}.`
  );
  parts.push(
    `Tone: ${profile.tonePreference}. Be concise and helpful. Be professional and kind without flattery or exaggerated praise.`
  );
  if (localModelClass === "3b") {
    parts.push(
      "Prefer one clear move per reply: answer the customer's question or ask one focused follow-up—not a long menu of options."
    );
  }

  if (profile.industry) {
    parts.push(`Industry: ${profile.industry}.`);
  }

  if (profile.hoursOfOperation) {
    parts.push(`Hours: ${profile.hoursOfOperation}.`);
  }

  if (profile.services.length > 0) {
    parts.push(`Services: ${profile.services.join(", ")}.`);
  }

  if (profile.neverPromise.length > 0) {
    parts.push(`Never promise: ${profile.neverPromise.join(", ")}.`);
  }

  parts.push(
    "If you don't have enough context to answer, say so clearly and offer to connect the customer with a human."
  );

  if (priorityNote && shouldIncludePriorityNote(priorityNote)) {
    parts.push(`Owner note: ${priorityNote}`);
  }

  return parts.join("\n\n");
}

export function buildSlimDefaultPrompt() {
  return [
    "You are Virgil, a personal assistant.",
    "Keep replies concise and direct. Be proactively helpful and avoid sycophancy.",
    "You run locally with limited memory. If important context seems missing, say so clearly instead of guessing.",
    "Suggest concrete next steps when they are useful, but stay honest about uncertainty.",
  ].join("\n\n");
}

function shouldIncludePriorityNote(priorityNote: string) {
  const wordCount = priorityNote.trim().split(/\s+/).filter(Boolean).length;
  if (wordCount > MAX_PRIORITY_NOTE_WORDS) {
    return false;
  }

  return !/recordIntake|escalateToHuman|summarizeOpportunity|saveMemory|recallMemory|setReminder/i.test(
    priorityNote
  );
}
