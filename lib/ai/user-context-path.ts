import { join } from "node:path";

/**
 * Resolved path for optional user context markdown.
 * Default is `workspace/user-context.md` so Turbopack can scope traces to that subtree.
 * Override with `USER_CONTEXT_PATH` (e.g. `./user-context.md` for legacy repo-root file).
 */
export function resolveUserContextPath(): string {
  const custom = process.env.USER_CONTEXT_PATH?.trim();
  if (custom) {
    return custom;
  }
  return join(
    /* turbopackIgnore: true */ process.cwd(),
    "workspace",
    "user-context.md"
  );
}
