import type { UIMessage } from "ai";
import type { ChatMessage } from "@/lib/types";
import { getTextFromMessage } from "@/lib/utils";

/**
 * Lengths of text in the last user and last assistant messages (v2-eval; no content).
 */
export function getLastUserAndAssistantTextLengths(messages: UIMessage[]): {
  userMessageLength: number;
  responseLength: number;
} {
  let lastUser: UIMessage | undefined;
  let lastAssistant: UIMessage | undefined;
  for (const m of messages) {
    if (m.role === "user") {
      lastUser = m;
    }
    if (m.role === "assistant") {
      lastAssistant = m;
    }
  }
  const userMessageLength = lastUser
    ? getTextFromMessage(lastUser as ChatMessage).length
    : 0;
  const responseLength = lastAssistant
    ? getTextFromMessage(lastAssistant as ChatMessage).length
    : 0;
  return { userMessageLength, responseLength };
}
