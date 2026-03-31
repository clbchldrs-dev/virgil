# Owner product vision (bespoke single-user)

This repository is scoped as **one personal assistant for a single owner**—not a multi-tenant SaaS template, not a generic product shell. If a commercial or multi-user product is ever needed, **start a new codebase** rather than stretching this one.

Normative intent for agents and maintainers:

## Audience

- **Single owner.** Features optimize for one person’s loop (fitness v1, then other personal domains using the same prioritization scaffold).
- **No SaaS positioning here.** Do not preserve architectures “in case” of commercialization in this repo.

## V1 focus: fitness-first

Priorities include:

- BJJ longevity and training frequency versus recovery.
- Conflict between sedentary work and high-impact training; structural integrity (e.g. lower back, mobility) versus reactive stretching alone.
- Protein and nutrition as performance constraints when relevant.
- Calisthenics precision goals versus available training bandwidth.
- When chores, work, or environment erode recovery needed for long-term training—**flag the tradeoff**, don’t hand-wave.

Later personal domains (creative, professional narrative, etc.) may reuse **weekly deltas, blockers, and realms**—still **personal**, not productized for strangers.

## Feedback model: variance, not cheerleading

- Prefer **deltas** between **stated goals** and **what was logged** (chat, weekly snapshots, blockers)—not empty praise.
- When a protocol is skipped (e.g. mobility while workouts are logged), state **risk and downstream consequences** (injury risk, delayed milestones)—**systems framing**, not moralizing.
- **Voice:** dry, earnest, systems-level; **light wit** allowed where it sharpens a point—never sycophantic, never punching down, never using humor to dodge hard feedback.

## Data and security tiers

| Tier | Rule |
|------|------|
| **High risk** | No programmatic banking or investment API credentials in this app. No plaintext storage of financial authentication tokens. |
| **Descriptive context** | Lifestyle and training data, professional/creative **description**, and **aggregates** (e.g. progress toward a stated retirement target) may inform prompts and memory. |
| **Out of scope until a separate review** | Raw account access, Plaid-style links, or tokenized live balances. |

## Goal weekly metrics (`GoalWeeklySnapshot.metrics`)

`metrics` is flexible JSON (see `lib/db/schema.ts`). Suggested keys for fitness tracking (all owner-entered or derived in chat—never scraped from banks):

| Key | Meaning (example) |
|-----|-------------------|
| `bjj_sessions` | Sessions in the week |
| `mt_sessions` | Muay Thai or cross-training if used |
| `mobility_sessions` | Dedicated mobility / prehab sessions |
| `protein_adherence_band` | e.g. `low` / `ok` / `high` vs target |
| `back_symptoms` | Short note or scale if logged |
| `desk_load_proxy` | Rough workload / sedentary load if tracked |
| `sleep_hours` | Average or range |

Version informally by adding `_v` notes in memory or a `metricsSchemaVersion` field when you change shape.

## Personal baseline file

- A file such as `caleb-baseline.txt` can hold sensitive life and financial **targets**. Treat it as **private**.
- **Options:** keep the repo strictly private; or move the canonical file to an **untracked** path (e.g. `owner-baseline.local.txt` at repo root—see `.gitignore`) and point loaders at it via `BASELINE_PATH` in `scripts/load-baseline-mem0.ts`.
- Do not commit credentials or session tokens into baseline text.

## Related code

- Prompts: `lib/ai/goal-guidance-prompt.ts`, `lib/ai/slim-prompt.ts`, `lib/ai/companion-prompt.ts`
- Weekly / blockers API: `app/(chat)/api/goal-guidance/`
- Pruning candidates (legacy multi-user / demo paths): [docs/PRUNING_CANDIDATES.md](PRUNING_CANDIDATES.md)
