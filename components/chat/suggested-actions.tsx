"use client";

import type { UseChatHelpers } from "@ai-sdk/react";
import { motion, useReducedMotion } from "framer-motion";
import { useRouter } from "next/navigation";
import { memo, useEffect, useMemo, useState } from "react";
import useSWR from "swr";
import {
  type ChatEmptySuggestion,
  EMPTY_STATE_RANDOM_PROMPT_POOL,
  firstSuggestion,
  MIDDLE_CONTINUE_SUGGESTION,
  pickRandom,
} from "@/lib/empty-suggestion-pools";
import type { ChatMessage } from "@/lib/types";
import { cn, fetcher } from "@/lib/utils";
import { Suggestion } from "../ai-elements/suggestion";
import { useSidebar } from "../ui/sidebar";
import type { VisibilityType } from "./visibility-selector";

type SuggestedActionsProps = {
  chatId: string;
  sendMessage: UseChatHelpers<ChatMessage>["sendMessage"];
  selectedVisibilityType: VisibilityType;
};

type InboxCounts = { night: number; jobs: number; proposals: number };

const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
const INBOX_URL = `${basePath}/api/chat/empty-state-inbox`;

function buildLeftFromInbox(data: InboxCounts): {
  lines: readonly [string, string];
  ariaLabel: string;
  title: string;
} {
  const { night, jobs, proposals } = data;
  const tokens: { label: string; count: number }[] = [];
  if (night > 0) {
    tokens.push({ label: "Night", count: night });
  }
  if (jobs > 0) {
    tokens.push({ label: "Jobs", count: jobs });
  }
  if (proposals > 0) {
    tokens.push({ label: "Pending", count: proposals });
  }

  const ariaLabel = `Background inbox: ${night} night insight(s), ${jobs} active job(s), ${proposals} proposal(s). Opens background activity.`;
  const title = `Night ${night} · Jobs ${jobs} · Pending ${proposals}`;

  if (tokens.length === 0) {
    return {
      lines: ["Quiet", ""],
      ariaLabel:
        "No night insights, background jobs, or proposals awaiting review. Open background activity.",
      title,
    };
  }

  return {
    lines: [
      tokens.map((t) => t.label).join(" · "),
      tokens.map((t) => String(t.count)).join(" · "),
    ] as const,
    ariaLabel,
    title,
  };
}

function PureSuggestedActions({ chatId, sendMessage }: SuggestedActionsProps) {
  const router = useRouter();
  const { setOpenMobile } = useSidebar();
  const prefersReducedMotion = useReducedMotion();

  const { data: inbox = { night: 0, jobs: 0, proposals: 0 } } =
    useSWR<InboxCounts>(INBOX_URL, fetcher, {
      fallbackData: { night: 0, jobs: 0, proposals: 0 },
    });

  const leftDisplay = useMemo(() => buildLeftFromInbox(inbox), [inbox]);

  const [right, setRight] = useState<ChatEmptySuggestion>(() =>
    firstSuggestion(EMPTY_STATE_RANDOM_PROMPT_POOL)
  );

  useEffect(() => {
    setRight(pickRandom(EMPTY_STATE_RANDOM_PROMPT_POOL));
  }, []);

  const slots = [
    {
      key: "empty-sugg-left",
      kind: "inbox" as const,
      lines: leftDisplay.lines,
      uppercaseLine: true,
      translate: "md:translate-y-4",
      animIndex: 0,
      suggestion: "",
      ariaLabel: leftDisplay.ariaLabel,
      title: leftDisplay.title,
    },
    {
      key: "empty-sugg-mid",
      kind: "continue" as const,
      item: MIDDLE_CONTINUE_SUGGESTION,
      uppercaseLine: false,
      translate: "md:-translate-y-2",
      animIndex: 1,
      ariaLabel: "Start new chat",
      title: undefined as string | undefined,
    },
    {
      key: "empty-sugg-right",
      kind: "prompt" as const,
      item: right,
      uppercaseLine: true,
      translate: "md:translate-y-4",
      animIndex: 2,
      ariaLabel: "Suggested conversation starter",
      title: undefined as string | undefined,
    },
  ] as const;

  const navigateBackground = () => {
    setOpenMobile(false);
    router.push(`${basePath}/background`);
  };

  const navigateHome = () => {
    setOpenMobile(false);
    router.push(`${basePath}/`);
  };

  return (
    <div
      className="flex w-full flex-col gap-2 pb-0.5 md:flex-row md:items-stretch md:justify-center md:gap-2.5"
      data-testid="suggested-actions"
      style={{
        scrollbarWidth: "none",
        WebkitOverflowScrolling: "touch",
        msOverflowStyle: "none",
      }}
    >
      {slots.map((slot) => (
        <div
          className={cn(
            "min-w-0 w-full md:max-w-[min(100%,11.5rem)] md:flex-1",
            slot.translate
          )}
          key={slot.key}
        >
          <motion.div
            animate={{ opacity: 1, y: 0 }}
            className="min-w-0"
            exit={{ opacity: 0, y: 12 }}
            initial={{ opacity: 0, y: 12 }}
            transition={{
              delay: prefersReducedMotion ? 0 : 0.05 * slot.animIndex,
              duration: 0.28,
              ease: [0.22, 1, 0.36, 1],
            }}
          >
            <motion.div
              className={cn(
                "min-w-0",
                !prefersReducedMotion && "suggestion-pill-12f-loop"
              )}
              style={
                prefersReducedMotion
                  ? undefined
                  : { animationDelay: `${0.35 + slot.animIndex * 0.08}s` }
              }
            >
              <Suggestion
                aria-label={slot.ariaLabel}
                className="inline-flex h-auto min-h-0 w-full flex-col items-center gap-0 whitespace-normal rounded-sm border border-border/50 px-2 py-2 text-center text-[12px] leading-[1.15] text-muted-foreground transition-all duration-150 hover:text-foreground hover:shadow-[var(--shadow-card)] md:text-[13px]"
                data-suggestion-pill="true"
                onClick={(suggestion) => {
                  if (slot.kind === "inbox") {
                    navigateBackground();
                    return;
                  }
                  if (slot.kind === "continue") {
                    navigateHome();
                    return;
                  }
                  window.history.pushState(
                    {},
                    "",
                    `${basePath}/chat/${chatId}`
                  );
                  sendMessage({
                    role: "user",
                    parts: [{ type: "text", text: suggestion }],
                  });
                }}
                suggestion={
                  slot.kind === "prompt"
                    ? slot.item.prompt
                    : slot.kind === "continue"
                      ? slot.item.prompt
                      : ""
                }
                title={slot.title}
              >
                <span
                  className={cn(
                    "block text-balance font-medium tracking-wide",
                    slot.uppercaseLine && "uppercase"
                  )}
                >
                  {slot.kind === "inbox"
                    ? slot.lines[0]
                    : slot.kind === "continue"
                      ? slot.item.lines[0]
                      : slot.item.lines[0]}
                </span>
                {(slot.kind === "inbox"
                  ? slot.lines[1]
                  : slot.kind === "continue"
                    ? slot.item.lines[1]
                    : slot.item.lines[1]
                ).length > 0 ? (
                  <span className="mt-0.5 block text-balance opacity-90">
                    {slot.kind === "inbox"
                      ? slot.lines[1]
                      : slot.kind === "continue"
                        ? slot.item.lines[1]
                        : slot.item.lines[1]}
                  </span>
                ) : null}
              </Suggestion>
            </motion.div>
          </motion.div>
        </div>
      ))}
    </div>
  );
}

export const SuggestedActions = memo(
  PureSuggestedActions,
  (prevProps, nextProps) => {
    if (prevProps.chatId !== nextProps.chatId) {
      return false;
    }
    if (prevProps.selectedVisibilityType !== nextProps.selectedVisibilityType) {
      return false;
    }

    return true;
  }
);
