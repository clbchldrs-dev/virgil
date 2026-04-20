import type { UseChatHelpers } from "@ai-sdk/react";
import { useMemo } from "react";
import type { ChatMessage } from "@/lib/types";

/** Words (whitespace-separated) in the active stream — one jaw pulse per new word. */
function countWords(s: string): number {
  const t = s.trim();
  if (!t) {
    return 0;
  }
  return t.split(/\s+/).length;
}

export type CalaveraStreamState = {
  /** Word count driving jaw motion (reasoning vs answer text). */
  jawWordCount: number;
  /** Thought cloud while reasoning is the active stream. */
  showThoughtBubble: boolean;
  /** Any assistant stream in progress — idle jaw when false. */
  isAssistantStreaming: boolean;
};

/**
 * Derives Calavera jaw + thought-bubble state from the last assistant message.
 * Reasoning takes precedence while it is still streaming or before answer text exists.
 */
export function useCalaveraStreamState(
  messages: ChatMessage[],
  status: UseChatHelpers<ChatMessage>["status"]
): CalaveraStreamState {
  return useMemo(() => {
    const idle: CalaveraStreamState = {
      jawWordCount: 0,
      showThoughtBubble: false,
      isAssistantStreaming: false,
    };

    if (status !== "streaming") {
      return idle;
    }

    const last = messages.at(-1);
    if (!last || last.role !== "assistant") {
      return idle;
    }

    let reasoningText = "";
    let reasoningStreaming = false;
    let answerText = "";

    for (const part of last.parts ?? []) {
      if (part.type === "reasoning") {
        reasoningText += part.text ?? "";
        if ("state" in part && part.state === "streaming") {
          reasoningStreaming = true;
        }
      }
      if (part.type === "text") {
        answerText += part.text ?? "";
      }
    }

    const isAssistantStreaming = true;

    if (reasoningStreaming) {
      return {
        jawWordCount: countWords(reasoningText),
        showThoughtBubble: true,
        isAssistantStreaming,
      };
    }

    return {
      jawWordCount: countWords(answerText),
      showThoughtBubble: false,
      isAssistantStreaming,
    };
  }, [messages, status]);
}
