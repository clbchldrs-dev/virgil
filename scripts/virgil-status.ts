/**
 * virgil:status — feature-grouped, fix-hinted status of your local setup.
 *
 * Replaces `dev:check` and `virgil:preflight`. One command, one view.
 *
 *   pnpm virgil:status              # human-readable output
 *   pnpm virgil:status --strict     # exit 1 if any "missing" rows
 *   pnpm virgil:status --json       # machine-readable
 */

import { resolve } from "node:path";
import { config } from "dotenv";
import type { StatusRow, StatusState } from "@/lib/integrations/virgil-status";
import { buildVirgilStatus } from "@/lib/integrations/virgil-status";

config({ path: resolve(process.cwd(), ".env.local") });
config({ path: resolve(process.cwd(), ".env") });

const strict = process.argv.includes("--strict");
const asJson = process.argv.includes("--json");

const LABEL: Record<StatusState, string> = {
  ok: "OK     ",
  missing: "MISSING",
  offline: "OFFLINE",
  info: "INFO   ",
};

const COLOR: Record<StatusState, (s: string) => string> = {
  ok: (s) => `\u001B[32m${s}\u001B[0m`,
  missing: (s) => `\u001B[31m${s}\u001B[0m`,
  offline: (s) => `\u001B[33m${s}\u001B[0m`,
  info: (s) => `\u001B[90m${s}\u001B[0m`,
};

function printRow(row: StatusRow) {
  const state = COLOR[row.state](LABEL[row.state]);
  const feature = row.feature.padEnd(28, " ");
  process.stdout.write(`  ${state}  ${feature} ${row.note}\n`);
  if (row.fix) {
    process.stdout.write(
      `                                       → ${row.fix}\n`
    );
  }
  if (row.docs) {
    process.stdout.write(
      `                                       📖 ${row.docs}\n`
    );
  }
}

async function main() {
  const snapshot = await buildVirgilStatus();

  if (asJson) {
    process.stdout.write(`${JSON.stringify(snapshot, null, 2)}\n`);
    process.exit(strict && snapshot.criticalMissing > 0 ? 1 : 0);
    return;
  }

  process.stdout.write(
    `\nVirgil status — ${new Date(snapshot.generatedAt).toLocaleString()}\n\n`
  );
  for (const group of snapshot.groups) {
    process.stdout.write(`${group.group}\n`);
    for (const row of group.rows) {
      printRow(row);
    }
    process.stdout.write("\n");
  }
  if (snapshot.criticalMissing > 0) {
    process.stdout.write(
      `${snapshot.criticalMissing} critical item(s) missing. Fix the → lines above.\n`
    );
  } else {
    process.stdout.write(
      "All critical features configured. Start dev with: pnpm virgil:start\n"
    );
  }
  process.exit(strict && snapshot.criticalMissing > 0 ? 1 : 0);
}

main().catch((err) => {
  process.stderr.write(`${err instanceof Error ? err.message : String(err)}\n`);
  process.exit(2);
});
