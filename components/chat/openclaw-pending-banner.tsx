"use client";

import { useCallback, useState } from "react";
import useSWR from "swr";
import { toast } from "@/components/chat/toast";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type PendingIntentRow = {
  id: string;
  skill: string | null;
  status: string;
  intent: Record<string, unknown>;
  createdAt: string;
  requiresConfirmation: boolean;
};

type OpenClawPendingResponse = {
  backend?: "openclaw" | "hermes";
  configured: boolean;
  delegationOnline?: boolean;
  openClawOnline: boolean;
  pendingConfirmations: PendingIntentRow[];
  queuedBacklog: number;
  offlineMessage: string | null;
};

const fetcher = async (url: string): Promise<OpenClawPendingResponse> => {
  const res = await fetch(url);
  if (res.status === 401) {
    return {
      backend: "openclaw",
      configured: false,
      delegationOnline: false,
      openClawOnline: false,
      pendingConfirmations: [],
      queuedBacklog: 0,
      offlineMessage: null,
    };
  }
  if (!res.ok) {
    throw new Error("Failed to load delegation queue");
  }
  return res.json() as Promise<OpenClawPendingResponse>;
};

function intentSummary(intent: Record<string, unknown>): string {
  const d = intent.description;
  if (typeof d === "string" && d.length > 0) {
    return d.length > 160 ? `${d.slice(0, 157)}…` : d;
  }
  const s = intent.skill;
  if (typeof s === "string") {
    return s;
  }
  return "Delegated task";
}

function backendLabel(response: OpenClawPendingResponse): string {
  return response.backend === "hermes" ? "Hermes" : "OpenClaw";
}

function isBackendOnline(response: OpenClawPendingResponse): boolean {
  return response.delegationOnline ?? response.openClawOnline;
}

export function OpenClawPendingBanner() {
  const base = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
  const url = `${base}/api/openclaw/pending`;

  const [idle, setIdle] = useState(false);

  const { data, error, mutate } = useSWR(url, fetcher, {
    refreshInterval: idle ? 0 : 15_000,
    revalidateOnFocus: !idle,
  });

  if (
    !idle &&
    data &&
    !data.configured &&
    data.queuedBacklog === 0 &&
    data.pendingConfirmations.length === 0
  ) {
    setIdle(true);
  }

  const [actingId, setActingId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState<Record<string, string>>({});
  const activeBackendLabel = data ? backendLabel(data) : "Delegation backend";

  const patchIntent = useCallback(
    async (id: string, action: "approve" | "reject", reason?: string) => {
      setActingId(id);
      try {
        const res = await fetch(url, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id, action, reason }),
        });
        const j = (await res.json().catch(() => ({}))) as {
          error?: string;
          detail?: string;
        };
        if (!res.ok) {
          throw new Error(
            typeof j.error === "string"
              ? j.detail
                ? `${j.error}: ${j.detail}`
                : j.error
              : "Update failed"
          );
        }
        await mutate();
        toast({
          type: "success",
          description:
            action === "approve"
              ? `Sent to ${activeBackendLabel}.`
              : "Delegation rejected.",
        });
      } catch (e) {
        toast({
          type: "error",
          description:
            e instanceof Error ? e.message : "Could not update delegation.",
        });
      } finally {
        setActingId(null);
      }
    },
    [mutate, url, activeBackendLabel]
  );

  if (error || !data) {
    return null;
  }

  const showOffline = Boolean(data.offlineMessage);
  const hasPending = data.pendingConfirmations.length > 0;

  if (hasPending) {
    return (
      <div className="border-border/50 border-b bg-muted/30 px-2 py-2 md:px-4">
        <div className="mx-auto flex max-w-4xl flex-col gap-2">
          {showOffline && (
            <p className="text-amber-800 text-xs dark:text-amber-200 md:text-sm">
              {data.offlineMessage}
            </p>
          )}
          <ul className="flex flex-col gap-2">
            {data.pendingConfirmations.map((row) => (
              <li
                className={cn(
                  "rounded-lg border border-border/60 bg-background/80 p-3 shadow-sm"
                )}
                key={row.id}
              >
                <p className="font-medium text-foreground text-xs md:text-sm">
                  Approve delegation task
                </p>
                <p className="mt-1 text-muted-foreground text-xs leading-relaxed">
                  <span className="font-mono text-[11px]">
                    {row.skill ?? "unknown"}
                  </span>
                  {" · "}
                  {intentSummary(row.intent)}
                </p>
                <div className="mt-2 flex flex-wrap items-end gap-2">
                  <label
                    className="flex min-w-[140px] flex-1 flex-col gap-1"
                    htmlFor={`openclaw-reject-${row.id}`}
                  >
                    <span className="text-muted-foreground text-[10px] uppercase tracking-wide">
                      Reject reason (optional)
                    </span>
                    <input
                      className="rounded-md border border-input bg-background px-2 py-1.5 text-xs"
                      id={`openclaw-reject-${row.id}`}
                      onChange={(ev) =>
                        setRejectReason((prev) => ({
                          ...prev,
                          [row.id]: ev.target.value,
                        }))
                      }
                      type="text"
                      value={rejectReason[row.id] ?? ""}
                    />
                  </label>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      disabled={actingId === row.id}
                      onClick={() =>
                        patchIntent(row.id, "reject", rejectReason[row.id])
                      }
                      size="sm"
                      type="button"
                      variant="outline"
                    >
                      Reject
                    </Button>
                    <Button
                      disabled={actingId === row.id || !isBackendOnline(data)}
                      onClick={() => patchIntent(row.id, "approve")}
                      size="sm"
                      title={
                        isBackendOnline(data)
                          ? undefined
                          : `${backendLabel(data)} is offline`
                      }
                      type="button"
                      variant="secondary"
                    >
                      Approve
                    </Button>
                  </div>
                </div>
                {!isBackendOnline(data) && (
                  <p className="mt-2 text-muted-foreground text-[11px]">
                    {backendLabel(data)} is offline — Approve may not reach the
                    gateway until it is reachable.
                  </p>
                )}
              </li>
            ))}
          </ul>
        </div>
      </div>
    );
  }

  if (showOffline) {
    return (
      <div
        className="border-border/50 border-b bg-muted/30 px-2 py-2.5 md:px-4"
        role="status"
      >
        <p className="mx-auto max-w-4xl text-amber-800 text-xs dark:text-amber-200 md:text-sm">
          {data.offlineMessage}
        </p>
      </div>
    );
  }

  if (!data.configured && data.queuedBacklog > 0) {
    return (
      <div
        className="border-border/50 border-b bg-muted/40 px-2 py-2.5 md:px-4"
        role="status"
      >
        <p className="mx-auto max-w-4xl text-muted-foreground text-xs md:text-sm">
          {backendLabel(data)} is not configured, but you have{" "}
          {String(data.queuedBacklog)} queued delegation(s). Configure the
          active delegation backend to send them.
        </p>
      </div>
    );
  }

  return null;
}
