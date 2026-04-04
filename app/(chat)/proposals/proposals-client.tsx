"use client";

import { format } from "date-fns";
import { useCallback, useMemo, useState } from "react";
import useSWR from "swr";
import { toast } from "@/components/chat/toast";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import type { Memory } from "@/lib/db/schema";
import { cn } from "@/lib/utils";

type Props = {
  initialMemories: Memory[];
};

function proposalsListUrl(includeDismissed: boolean) {
  const base = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
  const q = includeDismissed ? "days=90&includeDismissed=1" : "days=90";
  return `${base}/api/memories/proposals?${q}`;
}

function reviewDecision(meta: Record<string, unknown>): string | undefined {
  return meta.reviewDecision as string | undefined;
}

export function ProposalsClient({ initialMemories }: Props) {
  const [showDismissed, setShowDismissed] = useState(false);
  const listUrl = useMemo(
    () => proposalsListUrl(showDismissed),
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
  const [pending, setPending] = useState<string | null>(null);

  const patchDecision = useCallback(
    async (id: string, decision: "accepted" | "dismissed") => {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/api/memories/proposals/${id}`,
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
            decision === "accepted" ? "Proposal accepted." : "Dismissed.",
        });
      } catch (e) {
        toast({
          type: "error",
          description:
            e instanceof Error ? e.message : "Could not update proposal.",
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
        Newest first. Accepting sets a timestamp on the memory so you can track
        what you agreed to.
      </p>
      <div className="flex shrink-0 items-center gap-2">
        <input
          checked={showDismissed}
          className="size-4 rounded border border-input accent-primary"
          id="show-dismissed-proposals"
          onChange={(e) => setShowDismissed(e.target.checked)}
          type="checkbox"
        />
        <Label
          className="cursor-pointer font-normal text-sm"
          htmlFor="show-dismissed-proposals"
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
          Could not load proposals. Check your connection and try again.
        </p>
      </div>
    );
  }

  if (rawMemories.length === 0) {
    return (
      <div className="space-y-4">
        {listHeader}
        <p className="text-muted-foreground text-sm">
          No proposals yet. When background jobs or night review create tier
          &quot;propose&quot; memories, they will appear here.
        </p>
      </div>
    );
  }

  return (
    <div aria-busy={pending !== null} className="space-y-6">
      {listHeader}
      <ul className="space-y-3">
        {rawMemories.map((m) => {
          const meta = (m.metadata ?? {}) as Record<string, unknown>;
          const decision = reviewDecision(meta);
          const kindLabel = m.kind;
          return (
            <li
              className="rounded-lg border border-border/40 bg-background/80 p-3 sm:p-4"
              key={m.id}
            >
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <span className="rounded-md bg-muted px-2 py-0.5 font-medium text-[11px] text-muted-foreground uppercase tracking-wide">
                  {kindLabel}
                </span>
                <span className="rounded-md bg-primary/10 px-2 py-0.5 font-medium text-[11px] text-primary uppercase tracking-wide">
                  Propose
                </span>
                <span className="text-muted-foreground text-xs">
                  {format(new Date(m.createdAt), "MMM d, yyyy HH:mm")}
                </span>
                {m.proposedAt && (
                  <span className="text-muted-foreground text-xs">
                    Proposed {format(new Date(m.proposedAt), "MMM d, HH:mm")}
                  </span>
                )}
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
                    decision === "accepted" ||
                    decision === "dismissed"
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
                    (decision === "dismissed" || decision === "accepted") &&
                      "invisible pointer-events-none"
                  )}
                  disabled={
                    pending === m.id ||
                    decision === "dismissed" ||
                    decision === "accepted"
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
    </div>
  );
}
