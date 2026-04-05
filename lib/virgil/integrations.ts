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

/** Bearer ingest for scripts and `POST /api/ingest` (single-owner). */
export function isVirgilIngestEnabled(): boolean {
  return process.env.VIRGIL_INGEST_ENABLED === "1";
}

/** Resend inbound `email.received` → Memory (`POST /api/ingest/email`). */
export function isVirgilEmailIngestEnabled(): boolean {
  return process.env.VIRGIL_EMAIL_INGEST_ENABLED === "1";
}

export function isVirgilGitSignalsEnabled(): boolean {
  return process.env.VIRGIL_GIT_SIGNALS === "1";
}

export function isVirgilJournalFileParseEnabled(): boolean {
  return process.env.VIRGIL_JOURNAL_FILE_PARSE === "1";
}

/** Default relative to process.cwd() when `VIRGIL_JOURNAL_FILE_PATH` is unset. */
export function getVirgilJournalFilePath(): string {
  const raw = process.env.VIRGIL_JOURNAL_FILE_PATH?.trim();
  if (raw) {
    return raw;
  }
  return "workspace/journal/today.md";
}
