import { readFile, writeFile } from "./filesystem";
import { executeShell } from "./shell";
import {
  getJiraIssue,
  searchJiraIssues,
  updateJiraIssue,
} from "./jira";
import { listCalendarEvents } from "./calendar";
import { getBriefing } from "./briefing";

const isVercel = Boolean(process.env.VERCEL);

const localOnlyTools = {
  readFile,
  writeFile,
  executeShell,
  getBriefing,
} as const;

const universalTools = {
  getJiraIssue,
  searchJiraIssues,
  updateJiraIssue,
  listCalendarEvents,
} as const;

export function getCompanionTools() {
  if (isVercel) {
    return { ...universalTools };
  }
  return { ...universalTools, ...localOnlyTools };
}

export function getCompanionToolNames(): string[] {
  return Object.keys(getCompanionTools());
}
