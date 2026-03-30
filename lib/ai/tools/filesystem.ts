import { tool } from "ai";
import { z } from "zod";

function validatePath(resolved: string): string | null {
  const allowedRoots = (process.env.ALLOWED_FILE_ROOTS ?? "")
    .split(",")
    .filter(Boolean);

  if (allowedRoots.length > 0) {
    const withinRoot = allowedRoots.some((root) =>
      resolved.startsWith(root.trim())
    );
    if (!withinRoot) {
      return `Path ${resolved} is outside allowed roots: ${allowedRoots.join(", ")}`;
    }
  }

  return null;
}

export const readFile = tool({
  description:
    "Read the contents of a local file given an absolute or relative path.",
  inputSchema: z.object({
    path: z.string().describe("Absolute or relative file path to read"),
  }),
  execute: async ({ path }) => {
    const fs = await import("node:fs/promises");
    const nodePath = await import("node:path");
    const resolved = nodePath.resolve(path);

    const pathError = validatePath(resolved);
    if (pathError) {
      return { error: pathError };
    }

    try {
      const content = await fs.readFile(resolved, "utf-8");
      return { path: resolved, content, bytes: Buffer.byteLength(content) };
    } catch (err: unknown) {
      return { error: err instanceof Error ? err.message : String(err) };
    }
  },
});

export const writeFile = tool({
  description:
    "Write content to a local file. Creates the file and parent directories if they do not exist. Overwrites if it does.",
  inputSchema: z.object({
    path: z.string().describe("File path to write to"),
    content: z.string().describe("Content to write"),
  }),
  execute: async ({ path, content }) => {
    const fs = await import("node:fs/promises");
    const nodePath = await import("node:path");
    const resolved = nodePath.resolve(path);

    const pathError = validatePath(resolved);
    if (pathError) {
      return { error: pathError };
    }

    try {
      await fs.mkdir(nodePath.dirname(resolved), { recursive: true });
      await fs.writeFile(resolved, content, "utf-8");
      return {
        path: resolved,
        bytesWritten: Buffer.byteLength(content),
        success: true,
      };
    } catch (err: unknown) {
      return { error: err instanceof Error ? err.message : String(err) };
    }
  },
});
