"use client";

import { format } from "date-fns";
import { ChevronDownIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type {
  SerializedRankedSophonItem,
  SophonDailyBriefJson,
} from "@/lib/sophon/daily-brief-types";
import { cn } from "@/lib/utils";

type Props = { initialBrief: SophonDailyBriefJson };

const STALENESS_COPY: Record<
  SophonDailyBriefJson["staleness"]["reason"],
  string
> = {
  fresh: "",
  "gentle-nudge":
    "Your review loop has been quiet for a few days. Pick one item under Now and move it forward.",
  "structured-reset":
    "Quick reset: skim Now, defer one thing to Later, and block 2 minutes for the top item.",
  "accountability-prompt":
    "Re-commit explicitly: what is the first concrete action you will take today?",
};

function modeLabel(mode: string): string {
  if (mode === "auto") {
    return "Low risk — can auto-apply";
  }
  if (mode === "approve") {
    return "Needs your approval";
  }
  return "Suggestion only";
}

function PriorityBlock({
  title,
  items,
  suggestedActions,
}: {
  title: string;
  items: SerializedRankedSophonItem[];
  suggestedActions: SophonDailyBriefJson["suggestedActions"];
}) {
  const modeById = useMemo(() => {
    const m = new Map<string, (typeof suggestedActions)[number]>();
    for (const a of suggestedActions) {
      m.set(a.itemId, a);
    }
    return m;
  }, [suggestedActions]);

  if (items.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border/80 bg-muted/20 p-4">
        <h3 className="text-sm font-medium text-muted-foreground">{title}</h3>
        <p className="mt-1 text-sm text-muted-foreground">Nothing here yet.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold tracking-tight">{title}</h3>
      <ul className="space-y-3">
        {items.map((item) => {
          const action = modeById.get(item.id);
          return (
            <li
              className="rounded-xl border border-border bg-card p-4 shadow-sm"
              key={item.id}
            >
              <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
                <p className="font-medium text-foreground">{item.title}</p>
                {item.dueAt ? (
                  <span className="shrink-0 text-xs text-muted-foreground">
                    Due {format(new Date(item.dueAt), "MMM d")}
                  </span>
                ) : null}
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                {item.source} · score {item.score.toFixed(2)}
              </p>
              {item.explanations.length > 0 ? (
                <ul className="mt-2 list-inside list-disc text-sm text-muted-foreground">
                  {item.explanations.map((ex) => (
                    <li key={`${item.id}:${ex}`}>{ex}</li>
                  ))}
                </ul>
              ) : null}
              {action ? (
                <p
                  className={cn(
                    "mt-2 text-xs",
                    action.mode === "suggest"
                      ? "text-muted-foreground"
                      : "text-foreground/80"
                  )}
                >
                  {modeLabel(action.mode)} ({action.risk} risk)
                </p>
              ) : null}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function linesToArray(text: string): string[] {
  return text
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
}

export function SophonDailyClient({ initialBrief }: Props) {
  const router = useRouter();
  const [brief, setBrief] = useState(initialBrief);

  useEffect(() => {
    setBrief(initialBrief);
  }, [initialBrief]);
  const [title, setTitle] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [wins, setWins] = useState("");
  const [misses, setMisses] = useState("");
  const [carryForward, setCarryForward] = useState("");
  const [reviewSubmitting, setReviewSubmitting] = useState(false);

  const stalenessText = STALENESS_COPY[brief.staleness.reason];
  const base = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

  const addTask = async () => {
    const trimmed = title.trim();
    if (!trimmed) {
      toast.error("Add a title");
      return;
    }
    setSubmitting(true);
    try {
      let res: Response;
      try {
        res = await fetch(`${base}/api/sophon/tasks`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: trimmed,
            dueAt: dueDate || "",
          }),
        });
      } catch {
        toast.error("Could not add task");
        return;
      }
      if (!res.ok) {
        toast.error("Could not add task");
        return;
      }
      setTitle("");
      setDueDate("");
      toast.success("Task added");
      router.refresh();
    } finally {
      setSubmitting(false);
    }
  };

  const submitReview = async () => {
    const reviewDate = format(new Date(), "yyyy-MM-dd");
    setReviewSubmitting(true);
    try {
      let res: Response;
      try {
        res = await fetch(`${base}/api/sophon/daily`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            reviewDate,
            wins: linesToArray(wins),
            misses: linesToArray(misses),
            carryForward: linesToArray(carryForward),
          }),
        });
      } catch {
        toast.error("Could not save review");
        return;
      }
      if (!res.ok) {
        toast.error("Could not save review");
        return;
      }
      toast.success("Review saved");
      setWins("");
      setMisses("");
      setCarryForward("");
      setReviewOpen(false);
    } finally {
      setReviewSubmitting(false);
    }
  };

  return (
    <div className="space-y-8">
      {stalenessText ? (
        <div
          className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-foreground"
          role="status"
        >
          {stalenessText}
        </div>
      ) : null}

      <div className="grid gap-8 md:grid-cols-1">
        <PriorityBlock
          items={brief.now}
          suggestedActions={brief.suggestedActions}
          title="Now"
        />
        <PriorityBlock items={brief.next} suggestedActions={[]} title="Next" />
        <PriorityBlock
          items={brief.later}
          suggestedActions={[]}
          title="Later"
        />
      </div>

      <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
        <h3 className="text-sm font-semibold tracking-tight">Add priority</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Tasks feed the deterministic priority matrix (Option B v1). Calendar
          and memory streams are stubbed until wired.
        </p>
        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="min-w-0 flex-1 space-y-2">
            <Label htmlFor="sophon-title">Title</Label>
            <Input
              id="sophon-title"
              onChange={(e) => {
                setTitle(e.target.value);
              }}
              placeholder="What needs attention?"
              value={title}
            />
          </div>
          <div className="w-full space-y-2 sm:w-44">
            <Label htmlFor="sophon-due">Due (optional)</Label>
            <Input
              id="sophon-due"
              onChange={(e) => {
                setDueDate(e.target.value);
              }}
              type="date"
              value={dueDate}
            />
          </div>
          <Button
            className="shrink-0"
            disabled={submitting}
            onClick={async () => {
              await addTask();
            }}
            type="button"
          >
            {submitting ? "Adding…" : "Add"}
          </Button>
        </div>
      </div>

      <Collapsible onOpenChange={setReviewOpen} open={reviewOpen}>
        <CollapsibleTrigger asChild>
          <Button
            className="w-full justify-between sm:w-auto"
            type="button"
            variant="outline"
          >
            End-of-day review
            <ChevronDownIcon
              className={cn(
                "size-4 transition-transform",
                reviewOpen ? "rotate-180" : ""
              )}
            />
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent className="mt-4 space-y-4 rounded-xl border border-border bg-muted/20 p-4">
          <p className="text-sm text-muted-foreground">
            One line per item. Saves for today&apos;s date (UTC calendar day
            from your browser).
          </p>
          <div className="space-y-2">
            <Label htmlFor="sophon-wins">Wins</Label>
            <textarea
              className="border-input bg-input/30 focus-visible:border-ring focus-visible:ring-ring/50 aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 min-h-[80px] w-full rounded-xl border px-3 py-2 text-sm outline-none focus-visible:ring-[3px]"
              id="sophon-wins"
              onChange={(e) => {
                setWins(e.target.value);
              }}
              placeholder="One win per line"
              value={wins}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="sophon-misses">Misses</Label>
            <textarea
              className="border-input bg-input/30 focus-visible:border-ring focus-visible:ring-ring/50 aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 min-h-[80px] w-full rounded-xl border px-3 py-2 text-sm outline-none focus-visible:ring-[3px]"
              id="sophon-misses"
              onChange={(e) => {
                setMisses(e.target.value);
              }}
              placeholder="One miss per line"
              value={misses}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="sophon-carry">Carry forward</Label>
            <textarea
              className="border-input bg-input/30 focus-visible:border-ring focus-visible:ring-ring/50 aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 min-h-[80px] w-full rounded-xl border px-3 py-2 text-sm outline-none focus-visible:ring-[3px]"
              id="sophon-carry"
              onChange={(e) => {
                setCarryForward(e.target.value);
              }}
              placeholder="One item per line"
              value={carryForward}
            />
          </div>
          <Button
            disabled={reviewSubmitting}
            onClick={async () => {
              await submitReview();
            }}
            type="button"
          >
            {reviewSubmitting ? "Saving…" : "Save review"}
          </Button>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}
