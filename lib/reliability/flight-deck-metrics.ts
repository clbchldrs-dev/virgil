import type { SignalConfidence } from "@/lib/reliability/flight-deck-signals";

/** Card `type` values emitted by `GET /api/flight-deck` (see `lib/reliability/flight-deck-handler.ts`). */
export type FlightDeckCardType = "chat_fallback" | "queue_health";

export type RunbookTarget = {
  /** Stable id; matches anchors in `docs/operator-integrations-runbook.md`. */
  id: string;
  /** Repo-relative path to the doc containing the section. */
  docRelativePath: string;
  /** Section heading in that doc (for humans searching the file). */
  sectionTitle: string;
  /** Short operator hint (what to open or check next). */
  hint: string;
};

const GENERIC: RunbookTarget = {
  id: "operator-flight-deck",
  docRelativePath: "docs/operator-integrations-runbook.md",
  sectionTitle: "Operator flight deck",
  hint: "Start from the Operator flight deck section for card meanings and default investigation order.",
};

const CHAT_FALLBACK: RunbookTarget = {
  id: "flight-deck-chat-fallback-card",
  docRelativePath: "docs/operator-integrations-runbook.md",
  sectionTitle: "Chat fallback card (`chat_fallback`)",
  hint: "Use chat observability flags and model routing docs; confirm recent chat traffic produced telemetry.",
};

const QUEUE_HEALTH: RunbookTarget = {
  id: "flight-deck-queue-health-card",
  docRelativePath: "docs/operator-integrations-runbook.md",
  sectionTitle: "Queue and job health card (`queue_health`)",
  hint: "Follow the background job worker failure drill and verify QStash signing keys if jobs fail verification.",
};

const RUNBOOK_BY_TYPE: Record<FlightDeckCardType, RunbookTarget> = {
  chat_fallback: CHAT_FALLBACK,
  queue_health: QUEUE_HEALTH,
};

function isFlightDeckCardType(value: string): value is FlightDeckCardType {
  return value === "chat_fallback" || value === "queue_health";
}

/**
 * Maps a flight deck card type to a runbook section. Unknown types fall back to the generic flight deck section.
 */
export function getRunbookTargetForFlightDeckCard(input: {
  type: string;
  confidence?: SignalConfidence;
}): RunbookTarget {
  const base = isFlightDeckCardType(input.type)
    ? RUNBOOK_BY_TYPE[input.type]
    : GENERIC;

  if (input.confidence === "unknown") {
    return {
      ...base,
      hint: `${base.hint} If card confidence is unknown, check telemetry freshness and Postgres reachability before chasing model or queue causes.`,
    };
  }

  return base;
}

/**
 * Explicit fields operators can use for before/after triage notes (spreadsheets or an incident log).
 * Not persisted by the app; aligns summary API and audit tables with human-visible measurement.
 */
export const FLIGHT_DECK_MEASUREMENT_FIELDS = [
  "incident_id",
  "flight_deck_opened_at",
  "highest_severity_card_type",
  "highest_severity_level",
  "summary_confidence_at_open",
  "first_runbook_section_opened_at",
  "minutes_to_first_correct_action",
  "stable_state_observed_at",
  "digest_manual_run_request_id",
  "notes",
] as const;

export type FlightDeckMeasurementField =
  (typeof FLIGHT_DECK_MEASUREMENT_FIELDS)[number];
