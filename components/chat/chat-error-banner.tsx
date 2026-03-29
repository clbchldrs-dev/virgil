"use client";

import { AlertTriangleIcon, XIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  describeChatError,
  shouldEmphasizeLocalModelError,
} from "@/lib/chat-error-display";
import { cn } from "@/lib/utils";

type ChatErrorBannerProps = {
  error: Error | undefined;
  selectedModelId: string;
  onDismiss: () => void;
};

export function ChatErrorBanner({
  error,
  selectedModelId,
  onDismiss,
}: ChatErrorBannerProps) {
  if (!error) {
    return null;
  }

  const text = describeChatError(error);
  const local = shouldEmphasizeLocalModelError(error, selectedModelId);

  return (
    <div
      className={cn(
        "border-b px-2 py-2.5 md:px-4",
        local
          ? "border-amber-500/35 bg-amber-500/10"
          : "border-destructive/30 bg-destructive/10"
      )}
      role="alert"
    >
      <div className="mx-auto flex max-w-4xl gap-2 md:gap-3">
        <AlertTriangleIcon
          aria-hidden
          className={cn(
            "mt-0.5 size-4 shrink-0",
            local ? "text-amber-600 dark:text-amber-400" : "text-destructive"
          )}
        />
        <div className="min-w-0 flex-1 space-y-1">
          <p className="font-medium text-foreground text-xs md:text-sm">
            {local ? "Local model issue" : "Couldn’t complete the reply"}
          </p>
          <p className="whitespace-pre-wrap break-words text-muted-foreground text-xs leading-relaxed md:text-sm">
            {text}
          </p>
        </div>
        <Button
          aria-label="Dismiss error"
          className="size-8 shrink-0 p-0"
          onClick={onDismiss}
          type="button"
          variant="ghost"
        >
          <XIcon className="size-4" />
        </Button>
      </div>
    </div>
  );
}
