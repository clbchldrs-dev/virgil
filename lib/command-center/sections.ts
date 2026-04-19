/** Query param `section` on `/command-center` for deep links and redirects from legacy routes. */
export const COMMAND_CENTER_SECTION_QUERY = "section" as const;

export type CommandCenterSectionId = "triage" | "background" | "daily";

const SECTION_TO_ELEMENT_ID: Record<CommandCenterSectionId, string> = {
  triage: "command-center-triage",
  background: "command-center-background",
  daily: "command-center-daily",
};

export function getCommandCenterSectionElementId(
  section: CommandCenterSectionId
): string {
  return SECTION_TO_ELEMENT_ID[section];
}

export function parseCommandCenterSection(
  value: string | undefined
): CommandCenterSectionId | null {
  if (value === "triage" || value === "background" || value === "daily") {
    return value;
  }
  return null;
}

/** Path + query for flight deck cards and API deep links (no hash; works with server redirects). */
export function commandCenterDeepLink(section: CommandCenterSectionId): string {
  const base = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
  const q = new URLSearchParams();
  q.set(COMMAND_CENTER_SECTION_QUERY, section);
  return `${base}/command-center?${q.toString()}`;
}
