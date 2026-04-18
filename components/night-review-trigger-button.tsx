"use client";

import { MoonIcon } from "lucide-react";
import { type ComponentProps, useState } from "react";
import { toast } from "@/components/chat/toast";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const BASE = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

type TriggerJson =
  | {
      ok: true;
      runId: string;
      windowKey: string;
      message: string;
    }
  | {
      ok: false;
      skipped?: boolean;
      reason?: string;
      message?: string;
      error?: string;
      code?: string;
      detail?: string;
    };

type Props = {
  nightReviewEnabled: boolean;
  className?: string;
  size?: ComponentProps<typeof Button>["size"];
  variant?: ComponentProps<typeof Button>["variant"];
};

export function NightReviewTriggerButton({
  nightReviewEnabled,
  className,
  size = "default",
  variant = "secondary",
}: Props) {
  const [pending, setPending] = useState(false);

  const queueNightReview = async () => {
    if (!nightReviewEnabled || pending) {
      return;
    }
    setPending(true);
    try {
      const res = await fetch(`${BASE}/api/night-review/trigger`, {
        method: "POST",
      });
      const data = (await res.json()) as TriggerJson;

      if (res.ok && "ok" in data && data.ok) {
        toast({
          type: "success",
          description: data.message,
        });
        return;
      }

      if (res.status === 409 && data && "message" in data && data.message) {
        toast({
          type: "error",
          description: data.message,
        });
        return;
      }

      const errText =
        data && "error" in data && typeof data.error === "string"
          ? data.error
          : "Could not queue night review";
      const detail =
        data && "detail" in data && typeof data.detail === "string"
          ? ` ${data.detail}`
          : "";
      toast({
        type: "error",
        description: `${errText}${detail}`,
      });
    } catch {
      toast({
        type: "error",
        description: "Request failed. Check your connection and try again.",
      });
    } finally {
      setPending(false);
    }
  };

  const disabled = !nightReviewEnabled || pending;

  return (
    <Button
      className={cn(className)}
      disabled={disabled}
      onClick={queueNightReview}
      size={size}
      title={
        nightReviewEnabled
          ? "Queue a night review run now (same as the nightly job)"
          : "Turn on NIGHT_REVIEW_ENABLED for this environment"
      }
      type="button"
      variant={variant}
    >
      <MoonIcon className="size-4" />
      {pending ? "Queueing…" : "Run night review now"}
    </Button>
  );
}
