import type { Memory } from "@/lib/db/schema";

/** Facet order within a single night-review run (summary first, then detail). */
export const NIGHT_REVIEW_FACET_ORDER = [
  "summary",
  "pattern",
  "suggestedMemory",
  "toolGap",
  "improvement",
] as const;

export function nightReviewFacetLabel(facet: string | undefined): string {
  switch (facet) {
    case "summary":
      return "Summary";
    case "pattern":
      return "Pattern";
    case "suggestedMemory":
      return "Suggested memory";
    case "toolGap":
      return "Tool / skill gap";
    case "improvement":
      return "Improvement idea";
    default:
      return "Finding";
  }
}

function nightReviewMeta(m: Memory): Record<string, unknown> {
  return (m.metadata ?? {}) as Record<string, unknown>;
}

/** Completion / no-findings rows — not shown in the actionable digest list. */
export function isNightReviewCompletePhase(m: Memory): boolean {
  return nightReviewMeta(m).phase === "complete";
}

/** Dedupe identical content (keeps first occurrence — list should be newest-first). */
export function dedupeNightReviewMemoriesByContent(
  memories: Memory[]
): Memory[] {
  const seen = new Set<string>();
  const out: Memory[] = [];
  for (const mem of memories) {
    const key = mem.content.trim().toLowerCase();
    if (key.length === 0) {
      continue;
    }
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    out.push(mem);
  }
  return out;
}

function facetSortIndex(facet: string): number {
  const i = NIGHT_REVIEW_FACET_ORDER.indexOf(
    facet as (typeof NIGHT_REVIEW_FACET_ORDER)[number]
  );
  return i === -1 ? NIGHT_REVIEW_FACET_ORDER.length : i;
}

export type NightReviewRunGroup = {
  runId: string;
  windowKey: string;
  items: Memory[];
};

/**
 * Groups night-review memories by `runId`, drops completion markers, dedupes content,
 * orders runs newest-first and items by facet within each run.
 */
export function buildNightReviewRunGroups(
  memories: Memory[]
): NightReviewRunGroup[] {
  const actionable = memories.filter((m) => !isNightReviewCompletePhase(m));
  const deduped = dedupeNightReviewMemoriesByContent(actionable);
  const byRun = new Map<string, Memory[]>();

  for (const m of deduped) {
    const meta = nightReviewMeta(m);
    const runId = typeof meta.runId === "string" ? meta.runId : m.id;
    const list = byRun.get(runId) ?? [];
    list.push(m);
    byRun.set(runId, list);
  }

  const groups: NightReviewRunGroup[] = [];
  for (const [runId, items] of byRun) {
    const sorted = [...items].sort((a, b) => {
      const fa = String(nightReviewMeta(a).facet ?? "");
      const fb = String(nightReviewMeta(b).facet ?? "");
      const diff = facetSortIndex(fa) - facetSortIndex(fb);
      if (diff !== 0) {
        return diff;
      }
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
    const windowKey = String(nightReviewMeta(sorted[0]).windowKey ?? "");
    groups.push({ runId, windowKey, items: sorted });
  }

  groups.sort((a, b) => {
    const ta = Math.max(...a.items.map((i) => new Date(i.createdAt).getTime()));
    const tb = Math.max(...b.items.map((i) => new Date(i.createdAt).getTime()));
    return tb - ta;
  });

  return groups;
}
