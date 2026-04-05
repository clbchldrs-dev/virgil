# v2 Evaluation Data

This directory collects observations during v1 usage that will inform v2 development.
Drop notes here as markdown files. Virgil v2's self-evaluation system will be
calibrated against this human-collected data.

## What to capture

### missed-nudges.md

Times Virgil should have flagged something but didn't.
Format: date, what happened, what Virgil should have said, why it matters.

### noise-nudges.md

Times Virgil surfaced something unhelpful or irrelevant.
Format: date, what Virgil said, why it was noise.

### persona-notes.md

Observations about Virgil's personality — what works, what doesn't,
what the right tone is for different contexts.

### tool-wishes.md

Times you thought "Virgil should have DONE something, not just told me."
Format: date, situation, what action Virgil should have taken.

### night-mode-candidates.md

Tasks that would be ideal for autonomous overnight processing.
Format: description, frequency, data sources needed, expected output.

### memory-gaps.md

Times Virgil forgot something it should have known, or remembered
something irrelevant.
Format: date, what was forgotten/wrong, what the correct context was.

## Verify JSONL logging (local)

1. Set `V2_EVAL_LOGGING=true` in `.env.local` (see [`.env.example`](../../.env.example)).
2. Restart `pnpm dev` so the process picks up the flag.
3. Send a chat turn in the app, or run a one-off append: `V2_EVAL_LOGGING=true pnpm exec tsx` with a script that imports `logInteraction` from [`lib/v2-eval/interaction-log.ts`](../../lib/v2-eval/interaction-log.ts).
4. Confirm [`interactions.jsonl`](interactions.jsonl) grows by one JSON object per completed turn (metadata and lengths only; no raw message bodies).

## Optional machine logs (gitignored)

Set `V2_EVAL_LOGGING=true` (see [docs/tickets/2026-04-01-v2-groundwork-overview.md](../../docs/tickets/2026-04-01-v2-groundwork-overview.md)):

- `interactions.jsonl` — one JSON object per completed chat turn (no raw message bodies; lengths and routing metadata only).

Each line includes: `timestamp`, `chatId`, `requestedModelId`, `model` / `effectiveModelId` (executed model after fallback), `fallbackTier` (`ollama` | `gemini` | `gateway`), `promptVariant` (`full` | `slim` | `compact`), `isOllamaLocal`, `localModelClass` (local only), `userMessageLength`, `responseLength`, `toolsUsed`, `recentMemoryRowsInPrompt` (count of Memory rows injected into the system prompt), `recallMemoryInvoked`, `saveMemoryInvoked`. Use this file for aggregate routing and recall-quality analysis, not for storing conversation text.

- `traces.jsonl` — `V2_TRACE_LOGGING=true` (decision-trace stub aligned to v2 fields; best-effort token fields)
- `costs.jsonl` — `V2_EVAL_LOGGING=true` or `V2_COST_LOGGING=true` (gateway/gemini token usage rows when usage metadata is available)

Do not commit these files; they may contain conversation metadata.
