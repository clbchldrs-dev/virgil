import assert from "node:assert/strict";
import test from "node:test";
import type { Memory } from "../../lib/db/schema";
import {
  buildNightReviewRunGroups,
  dedupeNightReviewMemoriesByContent,
  isNightReviewCompletePhase,
  nightReviewFacetLabel,
} from "../../lib/night-review/digest-display";

function mem(
  partial: Partial<Memory> & Pick<Memory, "id" | "content">
): Memory {
  const now = new Date();
  return {
    userId: "u1",
    kind: "note",
    createdAt: now,
    updatedAt: now,
    metadata: {},
    ...partial,
  } as Memory;
}

test("isNightReviewCompletePhase detects completion markers", () => {
  assert.equal(
    isNightReviewCompletePhase(
      mem({
        id: "1",
        content: "done",
        metadata: { phase: "complete" },
      })
    ),
    true
  );
  assert.equal(
    isNightReviewCompletePhase(
      mem({ id: "2", content: "x", metadata: { phase: "finding" } })
    ),
    false
  );
});

test("dedupeNightReviewMemoriesByContent keeps first of identical text", () => {
  const a = mem({
    id: "a",
    content: "Same text",
    createdAt: new Date(1),
  });
  const b = mem({
    id: "b",
    content: "Same text",
    createdAt: new Date(2),
  });
  const out = dedupeNightReviewMemoriesByContent([a, b]);
  assert.equal(out.length, 1);
  assert.equal(out[0]?.id, "a");
});

test("buildNightReviewRunGroups groups by runId and orders facets", () => {
  const run = "run-1";
  const groups = buildNightReviewRunGroups([
    mem({
      id: "m1",
      content: "Improvement idea: z",
      metadata: {
        source: "night-review",
        runId: run,
        windowKey: "2026-03-28",
        phase: "finding",
        facet: "improvement",
      },
      createdAt: new Date(100),
    }),
    mem({
      id: "m2",
      content: "Night review summary: hello",
      metadata: {
        source: "night-review",
        runId: run,
        windowKey: "2026-03-28",
        phase: "finding",
        facet: "summary",
      },
      createdAt: new Date(50),
    }),
    mem({
      id: "done",
      content: "Night review completed",
      metadata: { source: "night-review", runId: run, phase: "complete" },
      createdAt: new Date(200),
    }),
  ]);

  assert.equal(groups.length, 1);
  assert.equal(groups[0]?.items.length, 2);
  assert.equal(groups[0]?.items[0]?.id, "m2");
  assert.equal(groups[0]?.items[1]?.id, "m1");
});

test("nightReviewFacetLabel covers facets", () => {
  assert.equal(nightReviewFacetLabel("summary"), "Summary");
  assert.equal(nightReviewFacetLabel(undefined), "Finding");
});
