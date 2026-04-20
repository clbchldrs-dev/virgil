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
  /**
   * Thought cloud for the full “thinking” phase: after send until the assistant’s first answer text arrives.
   * Covers submitted, pre-assistant streaming gap, reasoning (including after reasoning part finishes), tools, etc.
   */
  showThoughtBubble: boolean;
  /** Assistant response in flight (submitted → first token, or streaming). */
  isAssistantStreaming: boolean;
};

/**
 * Derives Calavera jaw + thought-bubble state from chat status and messages.
 * Thought bubble stays up until the assistant streams non-empty **text** (answer), not only while `reasoning.state === "streaming"`).
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

    const generating = status === "submitted" || status === "streaming";
    if (!generating) {
      return idle;
    }

    if (status === "submitted") {
      return {
        jawWordCount: 0,
        showThoughtBubble: true,
        isAssistantStreaming: true,
      };
    }

    // status === "streaming"
    const last = messages.at(-1);
    if (!last) {
      return {
        jawWordCount: 0,
        showThoughtBubble: true,
        isAssistantStreaming: true,
      };
    }

    if (last.role === "user") {
      return {
        jawWordCount: 0,
        showThoughtBubble: true,
        isAssistantStreaming: true,
      };
    }

    if (last.role !== "assistant") {
      return idle;
    }

    let reasoningText = "";
    for (const part of last.parts ?? []) {
      if (part.type === "reasoning") {
        reasoningText += part.text ?? "";
      }
    }

    let answerText = "";
    for (const part of last.parts ?? []) {
      if (part.type === "text") {
        answerText += part.text ?? "";
      }
    }

    const answerStarted = answerText.trim().length > 0;
    const showThoughtBubble = !answerStarted;
    const isAssistantStreaming = true;

    return {
      jawWordCount: countWords(showThoughtBubble ? reasoningText : answerText),
      showThoughtBubble,
      isAssistantStreaming,
    };
  }, [messages, status]);
}
