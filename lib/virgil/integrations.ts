/**
 * Future integration points (calendar, git signals, journal file).
 * All default off — set to "1" to enable when implemented.
 */
export function isVirgilCalendarIntegrationEnabled(): boolean {
  return process.env.VIRGIL_CALENDAR_INTEGRATION === "1";
}

export function isVirgilGitSignalsEnabled(): boolean {
  return process.env.VIRGIL_GIT_SIGNALS === "1";
}

export function isVirgilJournalFileParseEnabled(): boolean {
  return process.env.VIRGIL_JOURNAL_FILE_PARSE === "1";
}
