import { getBriefing } from "./briefing";
import { listCalendarEvents } from "./calendar";
import { readFile, writeFile } from "./filesystem";
import {
  getJiraIssue,
  isJiraConfigured,
  searchJiraIssues,
  updateJiraIssue,
} from "./jira";
import { executeShell } from "./shell";

const localOnlyTools = {
  readFile,
  writeFile,
  executeShell,
} as const;

const jiraTools = {
  getJiraIssue,
  searchJiraIssues,
  updateJiraIssue,
} as const;

/** Safe on Vercel: time + optional `workspace/user-context.md` (missing file is OK). */
const universalToolsBase = {
  getBriefing,
  listCalendarEvents,
} as const;

/** When adding tools here, update `getActiveCompanionToolIds` / `CANONICAL_COMPANION_TOOL_IDS` in `lib/deployment/capabilities.ts`. */
export function getCompanionTools() {
  const jira = isJiraConfigured() ? jiraTools : {};
  if (process.env.VERCEL) {
    return { ...universalToolsBase, ...jira };
  }
  return { ...universalToolsBase, ...jira, ...localOnlyTools };
}

export function getCompanionToolNames() {
  return Object.keys(getCompanionTools()) as (keyof ReturnType<
    typeof getCompanionTools
  >)[];
}
