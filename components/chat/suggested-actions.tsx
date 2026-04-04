"use client";

import type { UseChatHelpers } from "@ai-sdk/react";
import { motion, useReducedMotion } from "framer-motion";
import { memo, useEffect, useState } from "react";
import { getPersonalizedLeftEmptySuggestion } from "@/app/(chat)/empty-chat-suggestion-actions";
import {
  type ChatEmptySuggestion,
  CRYPTIC_FALLBACK_LEFT_SUGGESTIONS,
  DARK_SOULS_RIGHT_SUGGESTIONS,
  firstSuggestion,
  MIDDLE_CONTINUE_SUGGESTION,
  pickRandom,
} from "@/lib/empty-suggestion-pools";
import type { ChatMessage } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Suggestion } from "../ai-elements/suggestion";
import type { VisibilityType } from "./visibility-selector";

type SuggestedActionsProps = {
  chatId: string;
  sendMessage: UseChatHelpers<ChatMessage>["sendMessage"];
  selectedVisibilityType: VisibilityType;
};

function useEmptyChatSuggestions(): [
  ChatEmptySuggestion,
  ChatEmptySuggestion,
  ChatEmptySuggestion,
] {
  const [left, setLeft] = useState<ChatEmptySuggestion>(() =>
    firstSuggestion(CRYPTIC_FALLBACK_LEFT_SUGGESTIONS)
  );
  const [right, setRight] = useState<ChatEmptySuggestion>(() =>
    firstSuggestion(DARK_SOULS_RIGHT_SUGGESTIONS)
  );

  useEffect(() => {
    setRight(pickRandom(DARK_SOULS_RIGHT_SUGGESTIONS));
  }, []);

  useEffect(() => {
    let cancelled = false;
    getPersonalizedLeftEmptySuggestion().then((m) => {
      if (!cancelled) {
        setLeft(m);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return [left, MIDDLE_CONTINUE_SUGGESTION, right];
}

function PureSuggestedActions({ chatId, sendMessage }: SuggestedActionsProps) {
  const [left, middle, right] = useEmptyChatSuggestions();
  const prefersReducedMotion = useReducedMotion();

  const slots = [
    {
      key: "empty-sugg-left",
      item: left,
      translate: "md:translate-y-4",
      animIndex: 0,
      uppercaseLine: true,
    },
    {
      key: "empty-sugg-mid",
      item: middle,
      translate: "md:-translate-y-2",
      animIndex: 1,
      uppercaseLine: false,
    },
    {
      key: "empty-sugg-right",
      item: right,
      translate: "md:translate-y-4",
      animIndex: 2,
      uppercaseLine: true,
    },
  ] as const;

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
                className="inline-flex h-auto min-h-0 w-full flex-col items-center gap-0 whitespace-normal rounded-sm border border-border/50 px-2 py-2 text-center text-[12px] leading-[1.15] text-muted-foreground transition-all duration-150 hover:text-foreground hover:shadow-[var(--shadow-card)] md:text-[13px]"
                data-suggestion-pill="true"
                onClick={(suggestion) => {
                  window.history.pushState(
                    {},
                    "",
                    `${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/chat/${chatId}`
                  );
                  sendMessage({
                    role: "user",
                    parts: [{ type: "text", text: suggestion }],
                  });
                }}
                suggestion={slot.item.prompt}
              >
                <span
                  className={cn(
                    "block text-balance font-medium tracking-wide",
                    slot.uppercaseLine && "uppercase"
                  )}
                >
                  {slot.item.lines[0]}
                </span>
                {slot.item.lines[1].length > 0 ? (
                  <span className="mt-0.5 block text-balance opacity-90">
                    {slot.item.lines[1]}
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
