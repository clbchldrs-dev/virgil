import type { UIMessage } from "ai";

/**
 * Collects deduplicated tool names from assistant message parts (e.g. type `tool-getWeather`).
 */
export function extractToolNamesFromUIMessages(
  messages: UIMessage[]
): string[] {
  const seen = new Set<string>();
  for (const m of messages) {
    if (m.role !== "assistant" || !m.parts) {
      continue;
    }
    for (const part of m.parts) {
      const p = part as Record<string, unknown>;
      const partType = typeof p.type === "string" ? p.type : "";
      if (!partType.startsWith("tool-")) {
        continue;
      }
      const name = partType.slice("tool-".length);
      if (name.length > 0) {
        seen.add(name);
      }
    }
  }
  return [...seen].sort();
}
