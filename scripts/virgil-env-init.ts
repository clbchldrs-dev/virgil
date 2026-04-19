/**
 * virgil:env:init — append missing keys from .env.example to .env.local.
 *
 * Behavior:
 *  - If .env.local does not exist, copies .env.example verbatim and exits.
 *  - Otherwise, parses both files for KEY=VALUE lines (commented or not) and
 *    appends a "---- Added by virgil:env:init ----" block with any keys that
 *    appear in .env.example but not in .env.local. Every appended line is
 *    commented, so the initial run is zero-impact.
 *  - Never modifies existing lines; never reveals secret values from your
 *    current .env.local.
 *
 *  Flags:
 *    --dry-run   print what would be appended, don't write
 *    --force     copy .env.example over .env.local (destructive; prompts not supported)
 */

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const dryRun = process.argv.includes("--dry-run");
const force = process.argv.includes("--force");

const examplePath = resolve(process.cwd(), ".env.example");
const localPath = resolve(process.cwd(), ".env.local");

function extractKeys(contents: string): Set<string> {
  const keys = new Set<string>();
  for (const raw of contents.split(/\r?\n/)) {
    const line = raw.replace(/^#\s*/, "").trim();
    const match = line.match(/^([A-Z][A-Z0-9_]*)=/);
    if (match) {
      keys.add(match[1]);
    }
  }
  return keys;
}

function missingKeyLines(
  exampleContents: string,
  existingKeys: Set<string>
): string[] {
  const out: string[] = [];
  for (const raw of exampleContents.split(/\r?\n/)) {
    const line = raw.replace(/^#\s*/, "").trim();
    const match = line.match(/^([A-Z][A-Z0-9_]*)=/);
    if (!match) {
      continue;
    }
    if (existingKeys.has(match[1])) {
      continue;
    }
    // Store the ORIGINAL line (with or without leading #) so the user sees the
    // same documentation context as in .env.example.
    out.push(raw);
  }
  return out;
}

function main(): void {
  if (!existsSync(examplePath)) {
    process.stderr.write("virgil:env:init — .env.example not found.\n");
    process.exit(1);
    return;
  }
  const example = readFileSync(examplePath, "utf8");

  if (!existsSync(localPath) || force) {
    if (dryRun) {
      process.stdout.write(
        `Would ${existsSync(localPath) ? "overwrite" : "create"} .env.local from .env.example\n`
      );
      return;
    }
    writeFileSync(localPath, example, "utf8");
    process.stdout.write(
      `virgil:env:init — ${existsSync(localPath) ? "overwrote" : "created"} .env.local from .env.example.\n`
    );
    return;
  }

  const local = readFileSync(localPath, "utf8");
  const existingKeys = extractKeys(local);
  const lines = missingKeyLines(example, existingKeys);

  if (lines.length === 0) {
    process.stdout.write(
      "virgil:env:init — .env.local already has every key from .env.example. Nothing to do.\n"
    );
    return;
  }

  const header = `\n# ---- Added by virgil:env:init (${new Date().toISOString()}) ----\n# Uncomment and fill in as you adopt features. Run \`pnpm virgil:status\` to see what's missing.\n`;
  const block = `${header}${lines.map((l) => (l.startsWith("#") ? l : `# ${l}`)).join("\n")}\n`;

  if (dryRun) {
    process.stdout.write(
      `virgil:env:init — would append ${String(lines.length)} key(s) to .env.local:\n\n${block}`
    );
    return;
  }

  writeFileSync(localPath, local.replace(/\n+$/, "") + block, "utf8");
  process.stdout.write(
    `virgil:env:init — appended ${String(lines.length)} commented key(s) to .env.local.\n`
  );
}

main();
