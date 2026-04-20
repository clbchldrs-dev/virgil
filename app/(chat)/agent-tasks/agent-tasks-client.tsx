"use client";

import { formatDistanceToNow } from "date-fns";
import { ExternalLinkIcon } from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import useSWR from "swr";
import { toast } from "@/components/chat/toast";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { resolveAgentTaskImpactTier } from "@/lib/agent-tasks/impact-tier";
import type { AgentTask } from "@/lib/db/schema";
import { cn } from "@/lib/utils";

type OrchestrationHints = {
  triageEnabled: boolean;
  multiAgentPlannerEnabled: boolean;
  plannerStageCount: number | null;
};

type Props = {
  initialTasks: AgentTask[];
  /** From `?status=` when linked from Background, etc. */
  initialStatus?: string;
  githubAgentTasksConfigured: boolean;
  delegationConfigured: boolean;
  orchestrationHints: OrchestrationHints;
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

function hasOobAck(meta: Record<string, unknown>): boolean {
  const t = meta.outOfBandAcknowledgedAt;
  return typeof t === "string" && t.trim().length > 0;
}

export function AgentTasksClient({
  initialTasks,
  initialStatus,
  githubAgentTasksConfigured,
  delegationConfigured,
  orchestrationHints,
}: Props) {
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
  /** Tasks where the owner checked the out-of-band review box (no GitHub integration). */
  const [oobAckChecked, setOobAckChecked] = useState<Set<string>>(
    () => new Set()
  );
  const [completingTaskId, setCompletingTaskId] = useState<string | null>(null);
  const [completionDraft, setCompletionDraft] = useState("");

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

  const patchTask = useCallback(
    async (payload: {
      id: string;
      status: string;
      completionSummary?: string;
      outOfBandReviewAcknowledged?: boolean;
    }) => {
      setPending(payload.id);
      try {
        const body: Record<string, unknown> = {
          id: payload.id,
          status: payload.status,
        };
        if (payload.completionSummary !== undefined) {
          body.completionSummary = payload.completionSummary;
        }
        if (payload.outOfBandReviewAcknowledged === true) {
          body.outOfBandReviewAcknowledged = true;
        }
        const res = await fetch(
          `${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/api/agent-tasks`,
          {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
          }
        );
        if (!res.ok) {
          const j = (await res.json().catch(() => ({}))) as { error?: string };
          throw new Error(
            typeof j.error === "string" ? j.error : "Update failed"
          );
        }
        await mutate();
        setCompletingTaskId(null);
        setCompletionDraft("");
        toast({
          type: "success",
          description: `Task moved to ${STATUS_LABELS[payload.status] ?? payload.status}.`,
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

  const tryApprove = useCallback(
    (task: AgentTask) => {
      const tier = resolveAgentTaskImpactTier({
        taskType: task.taskType,
        priority: task.priority,
        metadata: task.metadata,
      });
      const meta = (task.metadata ?? {}) as Record<string, unknown>;

      if (
        tier === "elevated" &&
        githubAgentTasksConfigured &&
        !task.githubIssueUrl?.trim()
      ) {
        toast({
          type: "error",
          description:
            "High-impact task: a GitHub issue link is required before approval. Fix GitHub integration or recreate the task.",
        });
        return;
      }

      if (
        tier === "elevated" &&
        !githubAgentTasksConfigured &&
        !hasOobAck(meta) &&
        !oobAckChecked.has(task.id)
      ) {
        toast({
          type: "error",
          description:
            "Confirm out-of-band review using the checkbox before approving.",
        });
        return;
      }

      const needAckPayload =
        tier === "elevated" &&
        !githubAgentTasksConfigured &&
        !hasOobAck(meta) &&
        oobAckChecked.has(task.id);

      patchTask({
        id: task.id,
        status: "approved",
        outOfBandReviewAcknowledged: needAckPayload ? true : undefined,
      });
    },
    [githubAgentTasksConfigured, oobAckChecked, patchTask]
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

  const opsSummary = (
    <p className="text-muted-foreground text-xs leading-relaxed">
      This server: agent-task triage is{" "}
      <span className="text-foreground">
        {orchestrationHints.triageEnabled ? "enabled" : "disabled"}
      </span>
      ; delegation is{" "}
      <span className="text-foreground">
        {delegationConfigured ? "configured" : "not configured"}
      </span>
      {orchestrationHints.multiAgentPlannerEnabled ? (
        <>
          ; gateway multi-agent planner is on
          {orchestrationHints.plannerStageCount == null
            ? ""
            : ` (${orchestrationHints.plannerStageCount} planner stage${orchestrationHints.plannerStageCount === 1 ? "" : "s"})`}
        </>
      ) : null}
      .
    </p>
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
        {opsSummary}
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
      {opsSummary}
      <ul className="space-y-3">
        {tasks.map((task) => {
          const isExpanded = expanded.has(task.id);
          const transitions = statusTransitions(task.status);
          const meta = (task.metadata ?? {}) as Record<string, unknown>;
          const filePaths = meta.filePaths as string[] | undefined;
          const proposedApproach = meta.proposedApproach as string | undefined;
          const completionSummary = meta.completionSummary as
            | string
            | undefined;
          const tier = resolveAgentTaskImpactTier({
            taskType: task.taskType,
            priority: task.priority,
            metadata: task.metadata,
          });
          const showOobCheckbox =
            task.status === "submitted" &&
            tier === "elevated" &&
            !githubAgentTasksConfigured &&
            !hasOobAck(meta);
          const approveBlockedByGithub =
            tier === "elevated" &&
            githubAgentTasksConfigured &&
            !task.githubIssueUrl?.trim();

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
                    {tier === "elevated" ? (
                      <span className="rounded-md bg-amber-500/15 px-1.5 py-0.5 text-[11px] font-medium text-amber-900 uppercase tracking-wide dark:text-amber-100">
                        High impact
                      </span>
                    ) : null}
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
                  <div className="flex shrink-0 flex-col gap-2 sm:items-end">
                    {showOobCheckbox ? (
                      <label className="flex max-w-sm cursor-pointer items-start gap-2 text-left text-muted-foreground text-xs">
                        <input
                          checked={oobAckChecked.has(task.id)}
                          className="mt-0.5"
                          onChange={(e) => {
                            setOobAckChecked((prev) => {
                              const next = new Set(prev);
                              if (e.target.checked) {
                                next.add(task.id);
                              } else {
                                next.delete(task.id);
                              }
                              return next;
                            });
                          }}
                          type="checkbox"
                        />
                        <span>
                          I reviewed this high-impact task out-of-band (no
                          GitHub mirror on this deployment).
                        </span>
                      </label>
                    ) : null}
                    {approveBlockedByGithub ? (
                      <p className="max-w-xs text-amber-800 text-xs dark:text-amber-200">
                        Approve is blocked until a GitHub issue URL is present
                        on this task (normally created at submit time).
                      </p>
                    ) : null}
                    <div className="flex flex-wrap gap-2">
                      {transitions.map((t) => (
                        <Button
                          className="h-8 min-h-10 text-xs sm:min-h-8"
                          disabled={
                            pending === task.id ||
                            (t.kind === "status" &&
                              t.status === "approved" &&
                              approveBlockedByGithub)
                          }
                          key={t.kind === "delegate" ? "delegate" : t.status}
                          onClick={() => {
                            if (t.kind === "delegate") {
                              delegateTask(task.id);
                            } else if (t.status === "approved") {
                              tryApprove(task);
                            } else if (t.status === "done") {
                              setCompletingTaskId(task.id);
                              setCompletionDraft("");
                            } else {
                              patchTask({ id: task.id, status: t.status });
                            }
                          }}
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
                  </div>
                )}
              </div>

              {completingTaskId === task.id && task.status === "in_progress" ? (
                <div className="mt-3 space-y-2 rounded-lg border border-border/60 bg-muted/30 p-3">
                  <p className="font-medium text-muted-foreground text-xs">
                    Optional completion notes (stored on the task)
                  </p>
                  <Textarea
                    onChange={(e) => setCompletionDraft(e.target.value)}
                    placeholder="What changed, PR link, or follow-ups…"
                    value={completionDraft}
                  />
                  <div className="flex flex-wrap gap-2">
                    <Button
                      onClick={() =>
                        patchTask({
                          id: task.id,
                          status: "done",
                          completionSummary: completionDraft,
                        })
                      }
                      size="sm"
                      type="button"
                    >
                      Save & mark done
                    </Button>
                    <Button
                      onClick={() => {
                        setCompletingTaskId(null);
                        setCompletionDraft("");
                      }}
                      size="sm"
                      type="button"
                      variant="ghost"
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              ) : null}

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
                  {completionSummary ? (
                    <div className="space-y-1">
                      <p className="font-medium text-muted-foreground text-xs uppercase tracking-wide">
                        Completion notes
                      </p>
                      <p className="whitespace-pre-wrap text-sm leading-relaxed">
                        {completionSummary}
                      </p>
                    </div>
                  ) : null}
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
