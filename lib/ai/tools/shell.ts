import { tool } from "ai";
import { z } from "zod";

const BLOCKED_PATTERNS = [
  /rm\s+-r[f]?\s+\//, // rm -rf / or rm -r /anything
  /mkfs/,
  /dd\s+if=/,
  /:\(\)\s*\{.*:\s*\|.*&\s*\}/, // fork bomb
  />\s*\/dev\/sd/, // overwrite block devices
  /chmod\s+777\s+\//, // wide-open permissions on root
  /curl\s.*\|\s*(?:ba)?sh/, // pipe remote script to shell
  /wget\s.*\|\s*(?:ba)?sh/,
];

export const executeShell = tool({
  description:
    "Execute a shell command and return stdout/stderr. Use for running scripts, git operations, build commands, and file system operations.",
  inputSchema: z.object({
    command: z.string().describe("Shell command to execute"),
    cwd: z.string().optional().describe("Working directory for the command"),
    timeout: z
      .number()
      .optional()
      .default(30_000)
      .describe("Timeout in milliseconds"),
  }),
  execute: async ({ command, cwd, timeout }) => {
    if (BLOCKED_PATTERNS.some((pattern) => pattern.test(command))) {
      return { error: "Command blocked by safety filter" };
    }

    try {
      const { exec } = await import("node:child_process");
      const { promisify } = await import("node:util");
      const execAsync = promisify(exec);

      const { stdout, stderr } = await execAsync(command, {
        cwd: cwd ?? process.cwd(),
        timeout: timeout ?? 30_000,
        maxBuffer: 1024 * 1024,
      });
      return { stdout: stdout.trim(), stderr: stderr.trim(), exitCode: 0 };
    } catch (err: unknown) {
      if (err !== null && typeof err === "object") {
        const execErr = err as {
          stdout?: string;
          stderr?: string;
          code?: number;
          message?: string;
        };
        return {
          stdout: execErr.stdout?.trim() ?? "",
          stderr: execErr.stderr?.trim() ?? "",
          exitCode: execErr.code ?? 1,
          error: execErr.message ?? String(err),
        };
      }
      return { stdout: "", stderr: "", exitCode: 1, error: String(err) };
    }
  },
});
