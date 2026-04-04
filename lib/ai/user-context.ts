import { readFileSync } from "node:fs";
import { join } from "node:path";

/** Loads optional `user-context.md` (or `USER_CONTEXT_PATH`) for system prompts. */
export function getUserContext(): string {
  try {
    const contextPath =
      process.env.USER_CONTEXT_PATH ??
      join(/*turbopackIgnore: true*/ process.cwd(), "user-context.md");
    return readFileSync(contextPath, "utf-8");
  } catch {
    return "(No user context file found.)";
  }
}
