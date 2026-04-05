# MCP Baseline And Sophon Core Design

## Goal

Execute a focused two-part improvement session:

1. Audit and simplify the active MCP stack to reduce overlap/noise while preserving core capability.
2. Implement the first deterministic Sophon core slice in `sophon/src` with tests in `sophon/tests`.

## Scope

### In scope

- Local MCP config cleanup using reversible toggles (no destructive deletion).
- Repo documentation for MCP baseline, optional servers, and re-enable workflow.
- Sophon deterministic module foundation:
  - shared types,
  - scoring config,
  - adaptive 3-7 focus count,
  - deterministic priority matrix scoring,
  - focused unit tests.

### Out of scope

- Full Sophon API routes and DB persistence.
- Broad Virgil runtime refactors unrelated to this slice.
- Permanent removal of MCP servers or credentials.

## Design

## Part A: MCP Baseline

### Current observed shape

- Multiple overlapping browser-capable MCP servers are installed:
  - `cursor-ide-browser`,
  - `user-chrome-devtools`,
  - `user-MCP_DOCKER` (also exposes browser-style actions).
- Collaboration and filesystem servers are present and valuable:
  - `user-github`,
  - `user-filesystem`.
- `plugin-vercel-vercel` requires auth and is now authenticated in-session.

### Baseline decision

- Keep active by default:
  - `user-github`,
  - `user-filesystem`,
  - `cursor-ide-browser`,
  - `plugin-vercel-vercel`.
- Move to optional/off-by-default profile:
  - `user-chrome-devtools`,
  - `user-MCP_DOCKER`,
  - `plugin-snyk-secure-development-Snyk`.

### Why this design

- Reduces duplicated capability and tool routing ambiguity.
- Preserves needed daily capabilities for code + GitHub + browser + Vercel.
- Keeps specialized tools available behind explicit enablement.

### Failure handling

- If an optional server is needed (security scan, deeper perf, Docker helper), it can be re-enabled from documented config snippets.
- No permanent deletion; rollback is immediate by flipping enabled states.

## Part B: Sophon Deterministic Core (First Slice)

### Module boundary

- `sophon/src/types.ts`:
  - canonical candidate item shape and scored output.
- `sophon/src/config.ts`:
  - adaptive min/max constants and scoring weights.
- `sophon/src/priority-matrix.ts`:
  - `pickAdaptivePriorityCount`,
  - `scorePriorityMatrix`.
- `sophon/tests/priority-matrix.test.ts`:
  - deterministic ranking behavior tests,
  - adaptive 3-7 count behavior tests.

### Data flow

1. Inputs arrive as normalized candidate items.
2. Adaptive count is computed from pressure signals (calendar, carryover, staleness).
3. Weighted deterministic score is computed for each candidate.
4. Ranked output includes concise explanation tokens for transparency.

### Reliability constraints

- Deterministic output for fixed fixtures.
- Stable tie-break behavior.
- Adaptive count bounded to configured range.

### Testing strategy

- Unit tests in `sophon/tests` only for this pass.
- Run focused test command for Sophon slice.
- Run lint/type checks for touched files before completion.

## Execution Order

1. MCP baseline audit and local config changes.
2. Repo doc update for MCP baseline and server intent.
3. Sophon deterministic core implementation.
4. Sophon-focused tests and lint/type checks.

## Success Criteria

- MCP stack is simplified to a documented core baseline with reversible optional servers.
- Sophon deterministic core modules and tests exist and pass.
- No unrelated regressions introduced in existing Virgil runtime code paths.
