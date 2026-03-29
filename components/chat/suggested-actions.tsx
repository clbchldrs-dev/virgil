"use client";

import type { UseChatHelpers } from "@ai-sdk/react";
import { motion, useReducedMotion } from "framer-motion";
import { memo, useEffect, useState } from "react";
import { getPersonalizedMiddleEmptySuggestion } from "@/app/(chat)/empty-chat-suggestion-actions";
import {
  AMUSING_RANDOM_SUGGESTIONS,
  type ChatEmptySuggestion,
  DEFEAT_SCREEN_SUGGESTIONS,
  firstSuggestion,
  GENERIC_HELPFUL_MIDDLES,
  pickRandom,
} from "@/lib/empty-suggestion-pools";
import type { ChatMessage } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Suggestion } from "../ai-elements/suggestion";
import type { VisibilityType } from "./visibility-selector";

/** One vertical period (~sine); phase offset per index = worm. Lower = higher frequency. */
const WORM_DURATION_S = 2;
const WORM_Y_PX = [0, -3.5, -4.2, -3.5, 0, 3.5, 4.2, 3.5, 0] as const;

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
    firstSuggestion(DEFEAT_SCREEN_SUGGESTIONS)
  );
  const [middle, setMiddle] = useState<ChatEmptySuggestion>(() =>
    firstSuggestion(GENERIC_HELPFUL_MIDDLES)
  );
  const [right, setRight] = useState<ChatEmptySuggestion>(() =>
    firstSuggestion(AMUSING_RANDOM_SUGGESTIONS)
  );

  useEffect(() => {
    setLeft(pickRandom(DEFEAT_SCREEN_SUGGESTIONS));
    setRight(pickRandom(AMUSING_RANDOM_SUGGESTIONS));
  }, []);

  useEffect(() => {
    let cancelled = false;
    getPersonalizedMiddleEmptySuggestion().then((m) => {
      if (!cancelled) {
        setMiddle(m);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return [left, middle, right];
}

function PureSuggestedActions({ chatId, sendMessage }: SuggestedActionsProps) {
  const [left, middle, right] = useEmptyChatSuggestions();
  const prefersReducedMotion = useReducedMotion();
  const items = [left, middle, right];

  return (
    <div
      className="flex w-full flex-col gap-3 pb-1 md:flex-row md:items-end md:justify-center md:gap-4"
      data-testid="suggested-actions"
      style={{
        scrollbarWidth: "none",
        WebkitOverflowScrolling: "touch",
        msOverflowStyle: "none",
      }}
    >
      {items.map((item, index) => (
        <div
          className={cn(
            "min-w-0 w-full md:max-w-[min(100%,13.75rem)] md:flex-1",
            index === 0 && "md:translate-y-8",
            index === 1 && "md:-translate-y-3",
            index === 2 && "md:translate-y-8"
          )}
          key={item.prompt}
        >
          <motion.div
            animate={{ opacity: 1, y: 0 }}
            className="min-w-0"
            exit={{ opacity: 0, y: 16 }}
            initial={{ opacity: 0, y: 16 }}
            transition={{
              delay: prefersReducedMotion ? 0 : 0.06 * index,
              duration: 0.38,
              ease: [0.22, 1, 0.36, 1],
            }}
          >
            <motion.div
              animate={prefersReducedMotion ? { y: 0 } : { y: [...WORM_Y_PX] }}
              className="min-w-0"
              transition={{
                delay: prefersReducedMotion
                  ? 0
                  : 0.42 + (index / 3) * WORM_DURATION_S,
                duration: WORM_DURATION_S,
                ease: "easeInOut",
                repeat: prefersReducedMotion ? 0 : Number.POSITIVE_INFINITY,
              }}
            >
              <Suggestion
                className="inline-flex h-auto w-full flex-col items-center gap-0.5 whitespace-normal rounded-sm border border-border/50 px-3 py-3 text-center text-[15px] leading-tight text-muted-foreground transition-all duration-200 hover:-translate-y-0.5 hover:text-foreground hover:shadow-[var(--shadow-card)] md:text-[16px]"
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
                suggestion={item.prompt}
              >
                <span className="block text-balance">{item.lines[0]}</span>
                <span className="mt-0.5 block text-balance">
                  {item.lines[1]}
                </span>
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
