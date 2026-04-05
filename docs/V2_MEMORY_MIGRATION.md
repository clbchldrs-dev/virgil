# V2 memory migration blueprint (v1 Postgres -> v2 tiers)

**Status:** Groundwork artifact for E10/T4.  
**Related:** [V2_MIGRATION.md](V2_MIGRATION.md), [V1_V2_RISK_AUDIT.md](V1_V2_RISK_AUDIT.md), ticket [T4](tickets/2026-04-01-v2-t4-memory-migration-blueprint.md).

---

## 1) v1 memory schema reference (source format)

Primary table: `Memory` in `lib/db/schema.ts`.

Core columns used by runtime paths:

- `id` (UUID primary key)
- `userId` (owner scoping boundary)
- `chatId` (optional source chat link)
- `kind` (`note` | `fact` | `goal` | `opportunity`)
- `tier` (`observe` | `propose` | `act`)
- `content` (plain text payload)
- `metadata` (JSON object, default `{}`)
- `proposedAt`, `approvedAt`, `appliedAt` (proposal lifecycle timestamps)
- `createdAt`, `updatedAt`

Write entrypoint: `saveMemoryRecord` in `lib/db/query-modules/memory.ts`.

---

## 2) Metadata keys in active code paths

These keys are not theoretical; they are referenced in query and route logic now.

### 2.1 Night review pipeline

- `source: "night-review"`  
  Producer: `lib/night-review/run-night-review.ts`  
  Consumer filters: `lib/db/query-modules/night-review.ts`
- `windowKey` (night-review idempotency window)  
  Producer: `lib/night-review/run-night-review.ts`  
  Consumer: `hasCompletedNightReviewForWindow` in `lib/db/query-modules/night-review.ts`
- `runId` (group findings by run)  
  Producer: `lib/night-review/run-night-review.ts`  
  Consumer/display grouping: `lib/night-review/digest-display.ts`
- `phase` (`finding` / `complete`)  
  Producer: `lib/night-review/run-night-review.ts`  
  Consumer: actionable filtering in `lib/db/query-modules/night-review.ts`
- `facet` (`summary`, `pattern`, `toolGap`, `suggestedMemory`, `improvement`)  
  Producer: `lib/night-review/run-night-review.ts`  
  Consumer labels/order: `lib/night-review/digest-display.ts`
- `reviewDecision` and `reviewedAt`  
  Producer (mutation): `setNightReviewMemoryDecision` in `lib/db/query-modules/night-review.ts`  
  Consumer: `getNightReviewMemoriesForUser` and `countActionableNightReviewInsights`

### 2.2 Ingest and background sources

- `source` + `ingestType`  
  Producer: `lib/ingest/general-ingest.ts`
- `source: "journal-parse"` + `date`  
  Producer: `lib/journal/parse-journal.ts`  
  Dedup consumer: `memoryExistsWithSourceDateAndContent` in `lib/db/query-modules/memory.ts`
- `sourceJobId`, `jobKind`, `facet` (`insight` / `proposal`)  
  Producer: `lib/background-jobs/job-persistence.ts`

---

## 3) Proposed v2 tier mapping (migration default)

This mapping preserves behavior while reducing migration ambiguity.

### L1 (hot / operational)

Import rows that are still behavior-driving:

- `tier = "propose"` and `approvedAt IS NULL` (pending proposals)
- Recent night-review findings (`metadata.source = "night-review"` and `metadata.phase = "finding"`) that are not dismissed
- Recent ingest notes with explicit action value (operator-defined recency window)

### L2 (durable semantic working set)

Import rows that should remain searchable and reusable:

- Most `tier = "observe"` rows
- Accepted proposal history (`approvedAt IS NOT NULL`)
- Goal/fact/note rows with durable signal

### L3 (cold/archive or external semantic store)

Optional move or delayed import:

- Very old low-touch notes
- Dismissed night-review findings (`metadata.reviewDecision = "dismissed"`)
- Rows below an operator-defined retention threshold

---

## 4) Dedup and night-review handling rules

Apply these during export/import:

1. Keep at most one completion marker per `(userId, windowKey)` where `metadata.source = "night-review"` and `metadata.phase = "complete"`.
2. Preserve `reviewDecision` and `reviewedAt` for findings (do not re-open dismissed insights by default).
3. Preserve `runId` and `windowKey` to keep grouped digest history reconstructable.
4. For journal parse rows, preserve `source = "journal-parse"` and `date` so existing dedup logic can be recreated in v2.

---

## 5) Recommended export path (June 2026)

Recommended default: **one explicit TypeScript export script against v1 Postgres** that writes newline-delimited JSON.

Why this over ad-hoc CSV:

- Keeps `metadata` shape intact without JSON escaping friction.
- Supports deterministic transforms (tier bucketing, dedup markers, filtering dismissed rows).
- Is testable in repo and easier to re-run safely.

Suggested artifact set:

- `memory-export.ndjson` (rows + mapped target tier + migration notes)
- `memory-export-manifest.json` (run timestamp, row counts, filters, schema version)

---

## 6) Security and data risk callouts

- `content` may include sensitive personal context; treat exports as sensitive.
- There should be no API secrets in `Memory.content` by policy, but migration tooling should still scan for obvious key/token patterns before import.
- Avoid including unrelated large blobs in migration payloads; `Memory.content` is text-focused and should remain that way.

---

## 7) Minimum migration checks

Before any cutover rehearsal:

- Row counts by `kind` and `tier` match expected transform totals.
- Night-review rows retain `source`, `windowKey`, `runId`, `phase`.
- Pending proposals remain pending after import.
- Dismissed night-review rows stay excluded from actionable views unless explicitly requested.
