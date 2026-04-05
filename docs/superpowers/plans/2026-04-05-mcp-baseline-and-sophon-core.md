# MCP Baseline And Sophon Core Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reduce MCP tool overlap with a reversible local baseline, then ship a deterministic Sophon core slice with tests.

**Architecture:** First, adjust local MCP configuration at the user profile level so core servers are prioritized and optional servers are explicitly documented. Then implement a pure TypeScript Sophon scoring core in `sophon/src` with narrow contracts and deterministic behavior, validated by focused `node:test` suites under `sophon/tests`.

**Tech Stack:** Cursor MCP local config (`/Users/caleb/.cursor/mcp.json`), TypeScript, Node test runner (`node:test` + `tsx`), existing repo docs.

---

## File Structure

**Create**
- `docs/superpowers/plans/2026-04-05-mcp-baseline-and-sophon-core.md` — execution plan for this approved design.
- `docs/superpowers/mcp-baseline.md` — core vs optional MCP profile, auth notes, rollback steps.
- `sophon/src/types.ts` — canonical candidate and scored-item contracts.
- `sophon/src/config.ts` — deterministic scoring constants and adaptive bounds.
- `sophon/src/priority-matrix.ts` — adaptive focus count + deterministic ranking logic.
- `sophon/tests/priority-matrix.test.ts` — unit tests for adaptive and ranking behavior.

**Modify**
- `/Users/caleb/.cursor/mcp.json` — local MCP baseline toggle to reduce overlapping servers.
- `sophon/README.md` — link to implemented deterministic core and tests.

---

### Task 1: Apply local MCP baseline (reversible)

**Files:**
- Modify: `/Users/caleb/.cursor/mcp.json`

- [ ] **Step 1: Write a local backup before edits**

```bash
cp "/Users/caleb/.cursor/mcp.json" "/Users/caleb/.cursor/mcp.before-2026-04-05.json"
```

- [ ] **Step 2: Verify backup exists and has content**

Run: `ls -l "/Users/caleb/.cursor/mcp.before-2026-04-05.json"`  
Expected: file exists with non-zero size.

- [ ] **Step 3: Update MCP config to core baseline + optional comments**

```json
{
  "mcpServers": {
    "github": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-github"]
    },
    "filesystem": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-filesystem", "/Users/caleb/Documents"]
    },
    "chrome-devtools": {
      "command": "npx",
      "args": ["-y", "chrome-devtools-mcp@latest"],
      "disabled": true
    },
    "MCP_DOCKER": {
      "command": "docker",
      "args": ["mcp", "gateway", "run"],
      "disabled": true
    }
  }
}
```

- [ ] **Step 4: Validate JSON parses cleanly**

Run: `node -e 'JSON.parse(require("node:fs").readFileSync("/Users/caleb/.cursor/mcp.json","utf8")); console.log("ok")'`  
Expected: prints `ok`.

- [ ] **Step 5: Commit repo-side evidence only (not home-dir config)**

```bash
git add docs/superpowers/mcp-baseline.md
git commit -m "docs: add MCP core baseline and optional profile guidance"
```

---

### Task 2: Document MCP baseline and rollback flow

**Files:**
- Create: `docs/superpowers/mcp-baseline.md`

- [ ] **Step 1: Write failing docs-check test by asserting file absence**

Run: `test -f docs/superpowers/mcp-baseline.md && echo "exists" || echo "missing"`  
Expected: `missing` (before file is created).

- [ ] **Step 2: Add baseline doc with core/optional profiles**

```md
# MCP Baseline

## Core profile (default on)

- `github`
- `filesystem`
- `cursor-ide-browser` (managed through Cursor plugin MCP descriptors)
- `plugin-vercel-vercel` (requires auth)

## Optional profile (off by default in local config)

- `chrome-devtools` — deep browser/perf diagnostics
- `MCP_DOCKER` — docker MCP gateway workflows
- `plugin-snyk-secure-development-Snyk` — security scanning sessions

## Why this split

- Prevent overlapping browser MCP tools from crowding tool selection.
- Keep daily coding loop focused on core capabilities.
- Preserve specialized tools for explicit workflows.

## Rollback

Restore local MCP config:

```bash
cp "/Users/caleb/.cursor/mcp.before-2026-04-05.json" "/Users/caleb/.cursor/mcp.json"
```
```

- [ ] **Step 3: Verify doc contains required sections**

Run: `rg "Core profile|Optional profile|Rollback" docs/superpowers/mcp-baseline.md`  
Expected: 3 matches.

- [ ] **Step 4: Run repo quality check for docs-only change**

Run: `pnpm check`  
Expected: PASS.

- [ ] **Step 5: Commit documentation**

```bash
git add docs/superpowers/mcp-baseline.md
git commit -m "docs: define MCP core and optional profiles"
```

---

### Task 3: Add Sophon deterministic contracts and config (TDD start)

**Files:**
- Create: `sophon/src/types.ts`
- Create: `sophon/src/config.ts`
- Test: `sophon/tests/priority-matrix.test.ts`

- [ ] **Step 1: Write failing tests first**

```ts
import assert from "node:assert/strict";
import { test } from "node:test";
import { pickAdaptivePriorityCount, scorePriorityMatrix } from "../src/priority-matrix";
import type { SophonCandidateItem } from "../src/types";

const fixtures: SophonCandidateItem[] = [
  {
    id: "a",
    title: "File taxes",
    source: "manual",
    impact: 0.9,
    urgency: 0.85,
    commitmentRisk: 0.8,
    effortFit: 0.4,
    decayRisk: 0.7,
    dueAt: null
  },
  {
    id: "b",
    title: "Clean inbox",
    source: "memory",
    impact: 0.2,
    urgency: 0.25,
    commitmentRisk: 0.2,
    effortFit: 0.8,
    decayRisk: 0.3,
    dueAt: null
  }
];

test("adaptive focus shrinks under high pressure", () => {
  const n = pickAdaptivePriorityCount({
    calendarLoad: 0.9,
    carryoverLoad: 0.85,
    stalenessPressure: 0.8
  });
  assert.equal(n, 3);
});

test("adaptive focus expands under low pressure", () => {
  const n = pickAdaptivePriorityCount({
    calendarLoad: 0.1,
    carryoverLoad: 0.2,
    stalenessPressure: 0.2
  });
  assert.equal(n, 7);
});

test("ranking is deterministic with explanation tokens", () => {
  const ranked = scorePriorityMatrix(fixtures);
  assert.equal(ranked.at(0)?.id, "a");
  assert.ok((ranked.at(0)?.explanations.length ?? 0) > 0);
});
```

- [ ] **Step 2: Run test to confirm failure**

Run: `pnpm -C sophon exec node --test --import tsx tests/priority-matrix.test.ts`  
Expected: FAIL with missing module/export errors.

- [ ] **Step 3: Add shared domain contracts**

```ts
export type SophonSource = "manual" | "calendar" | "existing-task" | "memory" | "habit";

export type SophonCandidateItem = {
  id: string;
  title: string;
  source: SophonSource;
  impact: number;
  urgency: number;
  commitmentRisk: number;
  effortFit: number;
  decayRisk: number;
  dueAt: Date | null;
};

export type RankedSophonItem = SophonCandidateItem & {
  score: number;
  explanations: string[];
};
```

- [ ] **Step 4: Add deterministic constants**

```ts
export const SOPHON_MIN_PRIORITIES = 3;
export const SOPHON_MAX_PRIORITIES = 7;

export const SOPHON_WEIGHTS = {
  impact: 0.28,
  urgency: 0.26,
  commitmentRisk: 0.2,
  effortFit: 0.14,
  decayRisk: 0.12
} as const;
```

- [ ] **Step 5: Commit contracts/config**

```bash
git add sophon/src/types.ts sophon/src/config.ts sophon/tests/priority-matrix.test.ts
git commit -m "feat(sophon): add deterministic core contracts and test scaffold"
```

---

### Task 4: Implement deterministic priority matrix and pass tests

**Files:**
- Create: `sophon/src/priority-matrix.ts`
- Test: `sophon/tests/priority-matrix.test.ts`

- [ ] **Step 1: Implement minimal deterministic logic**

```ts
import {
  SOPHON_MAX_PRIORITIES,
  SOPHON_MIN_PRIORITIES,
  SOPHON_WEIGHTS
} from "./config";
import type { RankedSophonItem, SophonCandidateItem } from "./types";

function clampUnit(n: number): number {
  if (n < 0) return 0;
  if (n > 1) return 1;
  return n;
}

export function pickAdaptivePriorityCount(input: {
  calendarLoad: number;
  carryoverLoad: number;
  stalenessPressure: number;
}): number {
  const pressure =
    (clampUnit(input.calendarLoad) +
      clampUnit(input.carryoverLoad) +
      clampUnit(input.stalenessPressure)) /
    3;

  if (pressure >= 0.7) return SOPHON_MIN_PRIORITIES;
  if (pressure <= 0.3) return SOPHON_MAX_PRIORITIES;

  const spread = SOPHON_MAX_PRIORITIES - SOPHON_MIN_PRIORITIES;
  return SOPHON_MAX_PRIORITIES - Math.round(spread * pressure);
}

export function scorePriorityMatrix(items: SophonCandidateItem[]): RankedSophonItem[] {
  return [...items]
    .map((item) => {
      const score =
        clampUnit(item.impact) * SOPHON_WEIGHTS.impact +
        clampUnit(item.urgency) * SOPHON_WEIGHTS.urgency +
        clampUnit(item.commitmentRisk) * SOPHON_WEIGHTS.commitmentRisk +
        clampUnit(item.effortFit) * SOPHON_WEIGHTS.effortFit +
        clampUnit(item.decayRisk) * SOPHON_WEIGHTS.decayRisk;

      return {
        ...item,
        score,
        explanations: [
          `impact:${item.impact.toFixed(2)}`,
          `urgency:${item.urgency.toFixed(2)}`,
          `commitmentRisk:${item.commitmentRisk.toFixed(2)}`
        ]
      };
    })
    .sort((a, b) => b.score - a.score || a.title.localeCompare(b.title));
}
```

- [ ] **Step 2: Run focused Sophon tests**

Run: `pnpm -C sophon exec node --test --import tsx tests/priority-matrix.test.ts`  
Expected: PASS (3 tests).

- [ ] **Step 3: Update Sophon README with implemented modules**

```md
## Implemented v1 core (current)

- `src/types.ts` — candidate/ranked item contracts
- `src/config.ts` — deterministic scoring constants
- `src/priority-matrix.ts` — adaptive focus-count and deterministic ranking
- `tests/priority-matrix.test.ts` — core behavior checks
```

- [ ] **Step 4: Run repo-level checks for touched code**

Run: `pnpm check && pnpm run type-check`  
Expected: PASS.

- [ ] **Step 5: Commit core implementation**

```bash
git add sophon/src/priority-matrix.ts sophon/README.md sophon/tests/priority-matrix.test.ts
git commit -m "feat(sophon): implement deterministic priority matrix core"
```

---

## Self-Review Checklist (completed by plan author before execution)

1. **Spec coverage:** This plan maps the approved spec into two independent tracks:
   - MCP baseline and docs (Tasks 1-2),
   - Sophon deterministic core and tests (Tasks 3-4).
2. **Placeholder scan:** No TODO/TBD placeholders remain; each action includes concrete file paths, commands, and expected outcomes.
3. **Type consistency:** `SophonCandidateItem` and `RankedSophonItem` are defined once in `sophon/src/types.ts` and reused in tests and matrix implementation.
