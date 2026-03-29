"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import type { EscalationRecord } from "@/lib/db/schema";

const statusColors: Record<string, string> = {
  pending: "bg-yellow-500/10 text-yellow-700 dark:text-yellow-400",
  acknowledged: "bg-blue-500/10 text-blue-700 dark:text-blue-400",
  resolved: "bg-green-500/10 text-green-700 dark:text-green-400",
};

export function EscalationList({
  initialEscalations,
}: {
  initialEscalations: EscalationRecord[];
}) {
  const [escalations, setEscalations] = useState(initialEscalations);

  async function updateStatus(id: string, status: "acknowledged" | "resolved") {
    try {
      const res = await fetch("/api/escalations", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, status }),
      });
      if (!res.ok) {
        throw new Error("Failed to update");
      }
      setEscalations((prev) =>
        prev.map((e) =>
          e.id === id
            ? {
                ...e,
                status,
                resolvedAt: status === "resolved" ? new Date() : e.resolvedAt,
              }
            : e
        )
      );
      toast.success(`Marked as ${status}`);
    } catch {
      toast.error("Failed to update status");
    }
  }

  if (escalations.length === 0) {
    return (
      <div className="rounded-xl border border-border/50 bg-card p-8 text-center text-muted-foreground">
        No escalations yet. When the assistant can't handle a question, it will
        appear here.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {escalations.map((e) => (
        <div
          className="rounded-xl border border-border/50 bg-card p-4 space-y-3"
          key={e.id}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-1 min-w-0">
              {e.customerName && (
                <p className="font-medium">{e.customerName}</p>
              )}
              <p className="text-sm text-foreground">{e.summary}</p>
              <p className="text-xs text-muted-foreground">
                {new Date(e.createdAt).toLocaleString()} &middot; Urgency:{" "}
                {e.urgency}
              </p>
            </div>
            <span
              className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium ${statusColors[e.status] ?? ""}`}
            >
              {e.status}
            </span>
          </div>
          {e.status !== "resolved" && (
            <div className="flex gap-2">
              {e.status === "pending" && (
                <Button
                  onClick={() => updateStatus(e.id, "acknowledged")}
                  size="sm"
                  variant="outline"
                >
                  Acknowledge
                </Button>
              )}
              <Button
                onClick={() => updateStatus(e.id, "resolved")}
                size="sm"
                variant="outline"
              >
                Mark resolved
              </Button>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
