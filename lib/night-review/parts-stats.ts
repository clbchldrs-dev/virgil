/** Extract tool-type keys from persisted UIMessage parts (type starts with `tool-`). */
export function collectToolTypeCounts(parts: unknown): Record<string, number> {
  const counts: Record<string, number> = {};
  if (!Array.isArray(parts)) {
    return counts;
  }
  for (const part of parts) {
    if (
      part &&
      typeof part === "object" &&
      "type" in part &&
      typeof (part as { type: unknown }).type === "string"
    ) {
      const type = (part as { type: string }).type;
      if (type.startsWith("tool-")) {
        counts[type] = (counts[type] ?? 0) + 1;
      }
    }
  }
  return counts;
}

/** Concatenate user/assistant visible text from parts (truncated). */
export function extractTextFromParts(parts: unknown, maxChars: number): string {
  if (!Array.isArray(parts)) {
    return "";
  }
  const chunks: string[] = [];
  let total = 0;
  for (const part of parts) {
    if (!part || typeof part !== "object") {
      continue;
    }
    const p = part as { type?: string; text?: string };
    if (p.type === "text" && typeof p.text === "string" && p.text.trim()) {
      const slice = p.text.trim();
      if (total + slice.length > maxChars) {
        chunks.push(slice.slice(0, Math.max(0, maxChars - total)));
        break;
      }
      chunks.push(slice);
      total += slice.length;
    }
  }
  return chunks.join("\n");
}
