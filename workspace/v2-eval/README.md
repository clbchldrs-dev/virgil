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

## Optional machine logs (gitignored)

When implemented (see [docs/tickets/2026-04-01-v2-groundwork-overview.md](../../docs/tickets/2026-04-01-v2-groundwork-overview.md)):

- `interactions.jsonl` — `V2_EVAL_LOGGING=true`
- `traces.jsonl` — `V2_TRACE_LOGGING=true` (planned)
- `costs.jsonl` — optional cost stub (planned)

Do not commit these files; they may contain conversation metadata.
