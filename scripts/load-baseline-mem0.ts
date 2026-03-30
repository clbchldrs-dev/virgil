/**
 * One-shot loader: reads caleb-baseline.txt, splits by section,
 * and adds each section to Mem0 with metadata tags.
 *
 * Usage:
 *   MEM0_API_KEY=m0-… USER_ID=<uuid> npx tsx scripts/load-baseline-mem0.ts
 *
 * USER_ID is your auth user id (UUID from the user table).
 * If you don't know it, query: SELECT id FROM "User" WHERE email = '…';
 *
 * Or pass --user-id <uuid> as a CLI arg.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { config } from "dotenv";

config({ path: ".env.local" });

const MEM0_API_KEY = process.env.MEM0_API_KEY;
if (!MEM0_API_KEY) {
  console.error("MEM0_API_KEY not set. Add it to .env.local or pass as env.");
  process.exit(1);
}

const userIdFlag = process.argv.indexOf("--user-id");
const USER_ID: string | undefined =
  (userIdFlag !== -1 ? process.argv[userIdFlag + 1] : undefined) ??
  process.env.USER_ID;

if (!USER_ID) {
  console.error(
    "USER_ID not set. Pass --user-id <uuid> or set USER_ID env.\n" +
      'Find yours: psql "$POSTGRES_URL" -c "SELECT id, email FROM \\"User\\";"'
  );
  process.exit(1);
}

const userId: string = USER_ID;

const baselinePath = resolve(process.cwd(), "caleb-baseline.txt");
const raw = readFileSync(baselinePath, "utf-8");

const SECTION_RE = /^===\s*(.+?)\s*===$/;

interface Section {
  name: string;
  tag: string;
  body: string;
}

function parseSections(text: string): Section[] {
  const lines = text.split("\n");
  const sections: Section[] = [];
  let current: Section | null = null;
  const preambleLines: string[] = [];

  for (const line of lines) {
    const m = SECTION_RE.exec(line);
    if (m) {
      if (current) {
        current.body = current.body.trim();
        sections.push(current);
      }
      const name = m[1];
      current = {
        name,
        tag: name.toLowerCase().replaceAll(/\s+/g, "_"),
        body: "",
      };
    } else if (current) {
      current.body += `${line}\n`;
    } else {
      preambleLines.push(line);
    }
  }
  if (current) {
    current.body = current.body.trim();
    sections.push(current);
  }
  const preamble = preambleLines.join("\n").trim();
  if (preamble) {
    sections.unshift({
      name: "BASELINE_META",
      tag: "baseline_meta",
      body: preamble,
    });
  }
  return sections;
}

async function addToMem0(
  content: string,
  userId: string,
  metadata: Record<string, unknown>
): Promise<unknown> {
  const res = await fetch("https://api.mem0.ai/v1/memories/", {
    method: "POST",
    headers: {
      Authorization: `Token ${MEM0_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      messages: [{ role: "user", content }],
      user_id: userId,
      metadata,
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Mem0 API ${res.status}: ${text}`);
  }
  return res.json();
}

async function main() {
  const sections = parseSections(raw);
  console.log(
    `Parsed ${sections.length} sections from caleb-baseline.txt\n`
  );
  console.log(`User ID: ${userId}\n`);

  let ok = 0;
  let fail = 0;

  for (const section of sections) {
    const label = section.name;
    const content = `[${label}]\n${section.body}`;
    const metadata = {
      source: "baseline",
      section: section.tag,
      kind: "fact",
      baseline_date: "2026-03-29",
    };

    process.stdout.write(`  Adding "${label}" (${section.body.length} chars)…`);
    try {
      await addToMem0(content, userId, metadata);
      console.log(" done");
      ok++;
    } catch (error) {
      console.log(` FAILED: ${error}`);
      fail++;
    }
  }

  console.log(`\nFinished: ${ok} added, ${fail} failed.`);
}

main();
