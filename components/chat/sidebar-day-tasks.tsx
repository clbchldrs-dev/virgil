"use client";

import { Trash2Icon } from "lucide-react";
import type { User } from "next-auth";
import { useCallback, useState } from "react";
import { toast } from "sonner";
import useSWR from "swr";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  useSidebar,
} from "@/components/ui/sidebar";
import { cn, fetcher } from "@/lib/utils";

const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

type DayTaskRow = {
  id: string;
  forDate: string;
  title: string;
  sortOrder: number;
  completedAt: string | null;
};

type DayTasksPayload = {
  forDate: string;
  tasks: DayTaskRow[];
};

export function SidebarDayTasks({ user }: { user: User | undefined }) {
  const { isMobile } = useSidebar();
  const [draft, setDraft] = useState("");
  const swrKey = user ? `${BASE_PATH}/api/day-tasks` : null;
  const { data, isLoading, mutate } = useSWR<DayTasksPayload>(swrKey, fetcher, {
    revalidateOnFocus: true,
  });

  const patchTask = useCallback(
    async (taskId: string, body: { title?: string; completed?: boolean }) => {
      const res = await fetch(`${BASE_PATH}/api/day-tasks/${taskId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const err = (await res.json().catch(() => ({}))) as {
          message?: string;
        };
        throw new Error(err.message ?? "Update failed");
      }
    },
    []
  );

  const deleteTask = useCallback(async (taskId: string) => {
    const res = await fetch(`${BASE_PATH}/api/day-tasks/${taskId}`, {
      method: "DELETE",
    });
    if (!res.ok && res.status !== 204) {
      const err = (await res.json().catch(() => ({}))) as {
        message?: string;
      };
      throw new Error(err.message ?? "Delete failed");
    }
  }, []);

  const addTask = useCallback(async (title: string) => {
    const res = await fetch(`${BASE_PATH}/api/day-tasks`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title }),
    });
    if (!res.ok) {
      const err = (await res.json().catch(() => ({}))) as {
        message?: string;
      };
      throw new Error(err.message ?? "Could not add task");
    }
  }, []);

  if (!user) {
    return null;
  }

  const tasks = data?.tasks ?? [];
  const labelDate = data?.forDate ?? "";

  const handleToggle = async (task: DayTaskRow) => {
    const next = task.completedAt == null;
    try {
      await patchTask(task.id, { completed: next });
      await mutate();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not update task");
    }
  };

  const handleDelete = async (taskId: string) => {
    try {
      await deleteTask(taskId);
      await mutate();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not delete task");
    }
  };

  const handleSubmit = async () => {
    const t = draft.trim();
    if (!t) {
      return;
    }
    try {
      await addTask(t);
      setDraft("");
      await mutate();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not add task");
    }
  };

  return (
    <SidebarGroup className="group-data-[collapsible=icon]:hidden shrink-0 px-2 py-1">
      <SidebarGroupLabel className="text-[10px]">Today</SidebarGroupLabel>
      <SidebarGroupContent className="space-y-2">
        {labelDate ? (
          <div className="px-0.5 font-mono text-[10px] text-sidebar-foreground/50">
            {labelDate}
          </div>
        ) : null}
        {isLoading && !data ? (
          <p className="px-0.5 text-[11px] text-sidebar-foreground/50">
            Loading…
          </p>
        ) : tasks.length === 0 ? (
          <p className="px-0.5 text-[11px] text-sidebar-foreground/50">
            No tasks yet.
          </p>
        ) : (
          <ul className="flex flex-col gap-1.5">
            {tasks.map((task) => {
              const done = task.completedAt != null;
              return (
                <li
                  className="group/item flex items-start gap-2 rounded-md px-0.5 py-0.5 hover:bg-sidebar-accent/40"
                  key={task.id}
                >
                  <input
                    aria-label={done ? `Completed: ${task.title}` : task.title}
                    checked={done}
                    className={cn(
                      "mt-0.5 size-3.5 shrink-0 rounded border-sidebar-border accent-sidebar-foreground",
                      isMobile ? "touch-manipulation" : ""
                    )}
                    onChange={() => {
                      handleToggle(task).catch(() => undefined);
                    }}
                    type="checkbox"
                  />
                  <span
                    className={cn(
                      "min-w-0 flex-1 text-[12px] leading-snug text-sidebar-foreground/90",
                      done && "text-sidebar-foreground/45 line-through"
                    )}
                  >
                    {task.title}
                  </span>
                  <Button
                    aria-label={`Delete ${task.title}`}
                    className="size-6 shrink-0 opacity-100 md:opacity-0 md:group-hover/item:opacity-100"
                    onClick={() => {
                      handleDelete(task.id).catch(() => undefined);
                    }}
                    size="icon"
                    type="button"
                    variant="ghost"
                  >
                    <Trash2Icon className="size-3 text-sidebar-foreground/50" />
                  </Button>
                </li>
              );
            })}
          </ul>
        )}
        <div className="flex gap-1 pt-0.5">
          <Input
            className="h-7 border-sidebar-border/60 bg-sidebar-accent/20 text-[12px]"
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                handleSubmit().catch(() => undefined);
              }
            }}
            placeholder="Add task…"
            value={draft}
          />
        </div>
      </SidebarGroupContent>
    </SidebarGroup>
  );
}
