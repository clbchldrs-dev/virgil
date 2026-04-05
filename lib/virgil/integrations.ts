/**
 * Integration gates (calendar, health ingest, git signals, journal file).
 * All default off — set to "1" to enable.
 */
export function isVirgilCalendarIntegrationEnabled(): boolean {
  return process.env.VIRGIL_CALENDAR_INTEGRATION === "1";
}

/** Bearer ingest from iOS/watchOS HealthKit companion. */
export function isVirgilHealthIngestEnabled(): boolean {
  return process.env.VIRGIL_HEALTH_INGEST_ENABLED === "1";
}

export function isVirgilGitSignalsEnabled(): boolean {
  return process.env.VIRGIL_GIT_SIGNALS === "1";
}

export function isVirgilJournalFileParseEnabled(): boolean {
  return process.env.VIRGIL_JOURNAL_FILE_PARSE === "1";
}
