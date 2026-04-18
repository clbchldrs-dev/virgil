"use client";

import { formatDistanceToNow } from "date-fns";
import { ExternalLinkIcon } from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import useSWR from "swr";
import { toast } from "@/components/chat/toast";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { AgentTask } from "@/lib/db/schema";
import { cn } from "@/lib/utils";

type Props = {
  initialTasks: AgentTask[];
  /** From `?status=` when linked from Background, etc. */
  initialStatus?: string;
};

const ALL_STATUSES = [
  "all",
  "submitted",
  "approved",
  "in_progress",
  "done",
  "rejected",
] as const;

type StatusFilter = (typeof ALL_STATUSES)[number];

const STATUS_LABELS: Record<string, string> = {
  all: "All",
  submitted: "Submitted",
  approved: "Approved to run",
  in_progress: "With agent",
  done: "Done",
  rejected: "Rejected",
};

const STATUS_BADGE_VARIANT: Record<
  string,
  "default" | "secondary" | "outline" | "destructive"
> = {
  submitted: "outline",
  approved: "default",
  in_progress: "secondary",
  done: "secondary",
  rejected: "destructive",
};

const PRIORITY_ORDER: Record<string, number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
};

function apiUrl(status: StatusFilter) {
  const base = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
  const q = status === "all" ? "" : `?status=${status}`;
  return `${base}/api/agent-tasks${q}`;
}

type StatusTransition =
  | { kind: "status"; status: string; label: string }
  | { kind: "delegate"; label: string };

function statusTransitions(current: string): StatusTransition[] {
  switch (current) {
    case "submitted":
      return [
        { kind: "status", status: "approved", label: "Approve for agents" },
        { kind: "status", status: "rejected", label: "Reject" },
      ];
    case "approved":
      return [
        { kind: "delegate", label: "Send to agent" },
        { kind: "status", status: "rejected", label: "Reject" },
      ];
    case "in_progress":
      return [
        { kind: "status", status: "done", label: "Done" },
        { kind: "status", status: "rejected", label: "Reject" },
      ];
    case "rejected":
      return [{ kind: "status", status: "submitted", label: "Reopen" }];
    case "done":
      return [{ kind: "status", status: "submitted", label: "Reopen" }];
    default:
      return [];
  }
}

type DelegationPayload = {
  ok: boolean;
  message?: string;
  error?: string;
  intentId?: string;
  status?: string;
};

function toastForDelegation(delegation: DelegationPayload): {
  type: "success" | "error";
  description: string;
} {
  if (delegation.ok) {
    return {
      type: "success",
      description:
        delegation.message ??
        (delegation.status === "sent"
          ? "Sent to the delegation backend."
          : "Delegated — intent queued for the execution agent."),
    };
  }
  if (
    delegation.error === "delegation_backend_offline" &&
    delegation.intentId
  ) {
    return {
      type: "success",
      description:
        delegation.message ??
        "Delegated — intent is queued; backend was unreachable.",
    };
  }
  return {
    type: "error",
    description:
      delegation.message ??
      "Delegation did not complete. Check pending intents.",
  };
}

function parseStatusFilter(raw: string | undefined): StatusFilter {
  if (!raw) {
    return "all";
  }
  return ALL_STATUSES.includes(raw as StatusFilter)
    ? (raw as StatusFilter)
    : "all";
}

export function AgentTasksClient({ initialTasks, initialStatus }: Props) {
  const [filter, setFilter] = useState<StatusFilter>(() =>
    parseStatusFilter(initialStatus)
  );
  const url = useMemo(() => apiUrl(filter), [filter]);

  const { data, error, isLoading, isValidating, mutate } = useSWR<{
    tasks: AgentTask[];
  }>(url, (u) => fetch(u).then((r) => r.json()), {
    fallbackData: filter === "all" ? { tasks: initialTasks } : undefined,
    keepPreviousData: true,
    revalidateOnFocus: true,
  });

  const tasks = useMemo(() => {
    const raw = data?.tasks ?? [];
    return [...raw].sort((a, b) => {
      const pa = PRIORITY_ORDER[a.priority] ?? 2;
      const pb = PRIORITY_ORDER[b.priority] ?? 2;
      if (pa !== pb) {
        return pa - pb;
      }
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
  }, [data]);

  const [pending, setPending] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const toggleExpand = useCallback((id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const patchStatus = useCallback(
    async (id: string, newStatus: string) => {
      setPending(id);
      try {
        const res = await fetch(
          `${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/api/agent-tasks`,
          {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ id, status: newStatus }),
          }
        );
        if (!res.ok) {
          const j = await res.json().catch(() => ({}));
          throw new Error(
            typeof j.error === "string" ? j.error : "Update failed"
          );
        }
        await mutate();
        toast({
          type: "success",
          description: `Task moved to ${STATUS_LABELS[newStatus] ?? newStatus}.`,
        });
      } catch (e) {
        toast({
          type: "error",
          description:
            e instanceof Error ? e.message : "Could not update task.",
        });
      } finally {
        setPending(null);
      }
    },
    [mutate]
  );

  const delegateTask = useCallback(
    async (id: string) => {
      setPending(id);
      try {
        const res = await fetch(
          `${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/api/agent-tasks/delegate`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ id }),
          }
        );
        const j = (await res.json().catch(() => ({}))) as {
          error?: string;
          delegation?: DelegationPayload;
          code?: string;
        };
        if (!res.ok) {
          throw new Error(
            typeof j.error === "string" ? j.error : "Delegation failed"
          );
        }
        await mutate();
        const { type, description } = toastForDelegation(
          j.delegation ?? { ok: false }
        );
        toast({ type, description });
      } catch (e) {
        toast({
          type: "error",
          description:
            e instanceof Error ? e.message : "Could not delegate task.",
        });
      } finally {
        setPending(null);
      }
    },
    [mutate]
  );

  const filterBar = (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex flex-wrap gap-1.5">
        {ALL_STATUSES.map((s) => (
          <button
            className={cn(
              "rounded-md border px-2.5 py-1 text-xs transition-colors",
              filter === s
                ? "border-primary bg-primary/10 font-medium text-primary"
                : "border-border text-muted-foreground hover:bg-muted"
            )}
            key={s}
            onClick={() => setFilter(s)}
            type="button"
          >
            {STATUS_LABELS[s]}
          </button>
        ))}
      </div>
      {isValidating && !isLoading ? (
        <p aria-live="polite" className="text-muted-foreground text-xs">
          Refreshing…
        </p>
      ) : null}
    </div>
  );

  if (error) {
    return (
      <div className="space-y-4">
        {filterBar}
        <p className="text-destructive text-sm" role="alert">
          Could not load tasks. Check your connection and try again.
        </p>
      </div>
    );
  }

  if (tasks.length === 0) {
    return (
      <div className="space-y-4">
        {filterBar}
        <p className="text-muted-foreground text-sm">
          {filter === "all"
            ? "No tasks yet. Submit one from chat (gateway model) — then approve here so execution agents can run it."
            : `No tasks with status "${STATUS_LABELS[filter]}".`}
        </p>
      </div>
    );
  }

  return (
    <div aria-busy={pending !== null} className="space-y-4">
      {filterBar}
      <ul className="space-y-3">
        {tasks.map((task) => {
          const isExpanded = expanded.has(task.id);
          const transitions = statusTransitions(task.status);
          const meta = (task.metadata ?? {}) as Record<string, unknown>;
          const filePaths = meta.filePaths as string[] | undefined;
          const proposedApproach = meta.proposedApproach as string | undefined;

          return (
            <li
              className="rounded-xl border border-border/50 bg-card/50 p-4 shadow-[var(--shadow-float)] sm:p-5"
              key={task.id}
            >
              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0 flex-1 space-y-1">
                  <button
                    className="text-left font-medium text-sm leading-snug hover:underline"
                    onClick={() => toggleExpand(task.id)}
                    type="button"
                  >
                    {task.title}
                  </button>
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge
                      variant={STATUS_BADGE_VARIANT[task.status] ?? "outline"}
                    >
                      {STATUS_LABELS[task.status] ?? task.status}
                    </Badge>
                    <span className="rounded-md bg-muted px-1.5 py-0.5 text-[11px] text-muted-foreground uppercase tracking-wide">
                      {task.taskType}
                    </span>
                    <span className="rounded-md bg-muted px-1.5 py-0.5 text-[11px] text-muted-foreground uppercase tracking-wide">
                      {task.priority}
                    </span>
                    <span className="text-muted-foreground text-xs">
                      {formatDistanceToNow(new Date(task.createdAt), {
                        addSuffix: true,
                      })}
                    </span>
                    {task.githubIssueUrl && (
                      <a
                        className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                        href={task.githubIssueUrl}
                        rel="noopener noreferrer"
                        target="_blank"
                      >
                        GitHub #{task.githubIssueNumber}
                        <ExternalLinkIcon className="size-3" />
                      </a>
                    )}
                  </div>
                </div>

                {transitions.length > 0 && (
                  <div className="flex shrink-0 flex-wrap gap-2">
                    {transitions.map((t) => (
                      <Button
                        className="h-8 min-h-10 text-xs sm:min-h-8"
                        disabled={pending === task.id}
                        key={t.kind === "delegate" ? "delegate" : t.status}
                        onClick={() =>
                          t.kind === "delegate"
                            ? delegateTask(task.id)
                            : patchStatus(task.id, t.status)
                        }
                        size="sm"
                        type="button"
                        variant={
                          t.kind === "status" && t.status === "rejected"
                            ? "outline"
                            : "secondary"
                        }
                      >
                        {t.label}
                      </Button>
                    ))}
                  </div>
                )}
              </div>

              {isExpanded && (
                <div className="mt-3 space-y-3 border-border/40 border-t pt-3">
                  <p className="whitespace-pre-wrap text-sm leading-relaxed">
                    {task.description}
                  </p>
                  {proposedApproach && (
                    <div className="space-y-1">
                      <p className="font-medium text-muted-foreground text-xs uppercase tracking-wide">
                        Proposed approach
                      </p>
                      <p className="whitespace-pre-wrap text-sm leading-relaxed">
                        {proposedApproach}
                      </p>
                    </div>
                  )}
                  {filePaths && filePaths.length > 0 && (
                    <div className="space-y-1">
                      <p className="font-medium text-muted-foreground text-xs uppercase tracking-wide">
                        Relevant files
                      </p>
                      <ul className="list-inside list-disc text-sm">
                        {filePaths.map((fp) => (
                          <li className="text-muted-foreground" key={fp}>
                            <code className="text-xs">{fp}</code>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {task.agentNotes && (
                    <div className="space-y-1">
                      <p className="font-medium text-muted-foreground text-xs uppercase tracking-wide">
                        Triage notes
                      </p>
                      <pre className="overflow-x-auto whitespace-pre-wrap rounded-lg bg-muted/50 p-3 text-xs leading-relaxed">
                        {task.agentNotes}
                      </pre>
                    </div>
                  )}
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
