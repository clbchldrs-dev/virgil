import "server-only";

import { readFile } from "node:fs/promises";
import path from "node:path";

const NIGHT_DIR = path.join(process.cwd(), "workspace", "night");

export type NightWorkspaceFiles = {
  heartbeat: string;
  soul: string;
  skills: string;
};

export async function loadNightWorkspaceFiles(): Promise<NightWorkspaceFiles> {
  const [heartbeat, soul, skills] = await Promise.all([
    readFile(path.join(NIGHT_DIR, "HEARTBEAT.md"), "utf8"),
    readFile(path.join(NIGHT_DIR, "SOUL.md"), "utf8"),
    readFile(path.join(NIGHT_DIR, "SKILLS.md"), "utf8"),
  ]);
  return { heartbeat, soul, skills };
}
