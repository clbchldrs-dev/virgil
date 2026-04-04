"use client";

import { format } from "date-fns";
import { useCallback, useMemo, useState } from "react";
import useSWR from "swr";
import { toast } from "@/components/chat/toast";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import type { Memory } from "@/lib/db/schema";
import {
  buildNightReviewRunGroups,
  nightReviewFacetLabel,
} from "@/lib/night-review/digest-display";
import { cn } from "@/lib/utils";

type Props = {
  initialMemories: Memory[];
};

function nightReviewListUrl(includeDismissed: boolean) {
  const base = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
  const q = includeDismissed ? "days=14&includeDismissed=1" : "days=14";
  return `${base}/api/memories/night-review?${q}`;
}

function reviewDecision(meta: Record<string, unknown>): string | undefined {
  return meta.reviewDecision as string | undefined;
}

export function NightInsightsClient({ initialMemories }: Props) {
  const [showDismissed, setShowDismissed] = useState(false);
  const listUrl = useMemo(
    () => nightReviewListUrl(showDismissed),
    [showDismissed]
  );

  const { data, error, mutate } = useSWR<{ memories: Memory[] }>(
    listUrl,
    (url) => fetch(url).then((r) => r.json()),
    {
      fallbackData: showDismissed ? undefined : { memories: initialMemories },
      keepPreviousData: true,
      revalidateOnFocus: true,
    }
  );

  const rawMemories = data?.memories ?? [];
  const groups = useMemo(
    () => buildNightReviewRunGroups(rawMemories),
    [rawMemories]
  );

  const [pending, setPending] = useState<string | null>(null);

  const patchDecision = useCallback(
    async (id: string, decision: "accepted" | "dismissed") => {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/api/memories/night-review/${id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ decision }),
        }
      );
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(
          typeof j.message === "string" ? j.message : "Update failed"
        );
      }
    },
    []
  );

  const act = useCallback(
    async (id: string, decision: "accepted" | "dismissed") => {
      setPending(id);
      try {
        await patchDecision(id, decision);
        await mutate();
        toast({
          type: "success",
          description:
            decision === "accepted" ? "Marked as accepted." : "Dismissed.",
        });
      } catch (e) {
        toast({
          type: "error",
          description:
            e instanceof Error ? e.message : "Could not update insight.",
        });
      } finally {
        setPending(null);
      }
    },
    [mutate, patchDecision]
  );

  const actBatch = useCallback(
    async (
      runKey: string,
      ids: string[],
      decision: "accepted" | "dismissed"
    ) => {
      if (ids.length === 0) {
        return;
      }
      setPending(`batch:${runKey}`);
      try {
        for (const id of ids) {
          await patchDecision(id, decision);
        }
        await mutate();
        toast({
          type: "success",
          description:
            decision === "accepted"
              ? `Accepted ${ids.length} insight(s).`
              : `Dismissed ${ids.length} insight(s).`,
        });
      } catch (e) {
        toast({
          type: "error",
          description:
            e instanceof Error ? e.message : "Could not update insights.",
        });
      } finally {
        setPending(null);
      }
    },
    [mutate, patchDecision]
  );

  const listHeader = (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-muted-foreground text-sm">
        Grouped by night-review run. Accept or dismiss suggestions; nothing
        applies to prompts until you accept memories elsewhere in the app.
      </p>
      <div className="flex shrink-0 items-center gap-2">
        <input
          checked={showDismissed}
          className="size-4 rounded border border-input accent-primary"
          id="show-dismissed"
          onChange={(e) => setShowDismissed(e.target.checked)}
          type="checkbox"
        />
        <Label
          className="cursor-pointer font-normal text-sm"
          htmlFor="show-dismissed"
        >
          Show dismissed
        </Label>
      </div>
    </div>
  );

  if (error) {
    return (
      <div className="space-y-4">
        {listHeader}
        <p className="text-destructive text-sm" role="alert">
          Could not load insights. Check your connection and try again.
        </p>
      </div>
    );
  }

  if (rawMemories.length === 0) {
    return (
      <div className="space-y-4">
        {listHeader}
        <p className="text-muted-foreground text-sm">
          No night-review insights yet. When night review runs and finds
          something worth remembering, it will show up here.
        </p>
      </div>
    );
  }

  if (groups.length === 0) {
    return (
      <div className="space-y-4">
        {listHeader}
        <p className="text-muted-foreground text-sm">
          No actionable findings in this window (only completion markers). New
          runs with summaries or patterns will appear here.
        </p>
      </div>
    );
  }

  return (
    <div aria-busy={pending !== null} className="space-y-6">
      {listHeader}
      <div className="flex flex-col gap-6">
        {groups.map((group) => {
          const pendingInRun = group.items.filter((m) => {
            const d = reviewDecision(nightReviewMeta(m));
            return d !== "accepted" && d !== "dismissed";
          });
          const pendingIds = pendingInRun.map((m) => m.id);
          const runLabel =
            group.windowKey ||
            (group.runId.length > 8
              ? `${group.runId.slice(0, 8)}…`
              : group.runId);

          return (
            <section
              className="rounded-xl border border-border/50 bg-card/50 p-4 shadow-[var(--shadow-float)] sm:p-5"
              key={group.runId}
            >
              <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="font-medium text-sm tracking-tight">
                    Run · {runLabel}
                  </h2>
                  <p className="text-muted-foreground text-xs">
                    {group.items.length} finding
                    {group.items.length === 1 ? "" : "s"} · newest first in list
                  </p>
                </div>
                {pendingIds.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    <Button
                      className="h-9 min-h-11 text-xs sm:min-h-9"
                      disabled={pending?.startsWith("batch")}
                      onClick={() =>
                        actBatch(group.runId, pendingIds, "accepted")
                      }
                      size="sm"
                      variant="secondary"
                    >
                      Accept all ({pendingIds.length})
                    </Button>
                    <Button
                      className="h-9 min-h-11 text-xs sm:min-h-9"
                      disabled={pending?.startsWith("batch")}
                      onClick={() =>
                        actBatch(group.runId, pendingIds, "dismissed")
                      }
                      size="sm"
                      variant="outline"
                    >
                      Dismiss all ({pendingIds.length})
                    </Button>
                  </div>
                )}
              </div>
              <ul className="space-y-3">
                {group.items.map((m) => {
                  const meta = nightReviewMeta(m);
                  const facet = meta.facet as string | undefined;
                  const decision = reviewDecision(meta);
                  return (
                    <li
                      className="rounded-lg border border-border/40 bg-background/80 p-3 sm:p-4"
                      key={m.id}
                    >
                      <div className="mb-2 flex flex-wrap items-center gap-2">
                        <span className="rounded-md bg-muted px-2 py-0.5 font-medium text-[11px] text-muted-foreground uppercase tracking-wide">
                          {nightReviewFacetLabel(facet)}
                        </span>
                        <span className="text-muted-foreground text-xs">
                          {format(new Date(m.createdAt), "MMM d, yyyy HH:mm")}
                        </span>
                        {decision === "accepted" && (
                          <span className="text-xs text-emerald-600 dark:text-emerald-400">
                            Accepted
                          </span>
                        )}
                        {decision === "dismissed" && (
                          <span className="text-muted-foreground text-xs">
                            Dismissed
                          </span>
                        )}
                      </div>
                      <p className="whitespace-pre-wrap text-sm leading-relaxed">
                        {m.content}
                      </p>
                      <div className="mt-3 flex flex-wrap justify-end gap-2 border-border/40 border-t pt-3">
                        <Button
                          className="h-9 min-h-11 text-xs sm:min-h-8"
                          disabled={
                            pending === m.id ||
                            pending?.startsWith("batch") ||
                            decision === "accepted"
                          }
                          onClick={() => act(m.id, "accepted")}
                          size="sm"
                          variant="secondary"
                        >
                          Accept
                        </Button>
                        <Button
                          className={cn(
                            "h-9 min-h-11 text-xs sm:min-h-8",
                            decision === "dismissed" &&
                              "invisible pointer-events-none"
                          )}
                          disabled={
                            pending === m.id || pending?.startsWith("batch")
                          }
                          onClick={() => act(m.id, "dismissed")}
                          size="sm"
                          variant="outline"
                        >
                          Dismiss
                        </Button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </section>
          );
        })}
      </div>
    </div>
  );
}

function nightReviewMeta(m: Memory): Record<string, unknown> {
  return (m.metadata ?? {}) as Record<string, unknown>;
}
