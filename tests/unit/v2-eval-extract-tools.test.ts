import assert from "node:assert/strict";
import { test } from "node:test";
import type { UIMessage } from "ai";
import { extractToolNamesFromUIMessages } from "@/lib/v2-eval/extract-tools-from-ui-messages";
import { getLastUserAndAssistantTextLengths } from "@/lib/v2-eval/turn-text-lengths";

test("extractToolNamesFromUIMessages dedupes and sorts tool names", () => {
  const messages = [
    {
      id: "a",
      role: "assistant",
      parts: [
        { type: "text", text: "hi" },
        { type: "tool-getWeather", toolCallId: "1", state: "output-available" },
        {
          type: "tool-recallMemory",
          toolCallId: "2",
          state: "output-available",
        },
      ],
    },
    {
      id: "b",
      role: "assistant",
      parts: [
        { type: "tool-getWeather", toolCallId: "3", state: "output-available" },
      ],
    },
  ] as unknown as UIMessage[];
  assert.deepEqual(extractToolNamesFromUIMessages(messages), [
    "getWeather",
    "recallMemory",
  ]);
});

test("getLastUserAndAssistantTextLengths uses last user and assistant", () => {
  const messages = [
    { id: "u1", role: "user", parts: [{ type: "text", text: "aa" }] },
    {
      id: "as1",
      role: "assistant",
      parts: [{ type: "text", text: "old" }],
    },
    { id: "u2", role: "user", parts: [{ type: "text", text: "bbbb" }] },
    {
      id: "as2",
      role: "assistant",
      parts: [{ type: "text", text: "ccc" }],
    },
  ] as unknown as UIMessage[];
  assert.deepEqual(getLastUserAndAssistantTextLengths(messages), {
    userMessageLength: 4,
    responseLength: 3,
  });
});
