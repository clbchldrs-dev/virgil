import { tool } from "ai";
import { z } from "zod";
import { companionToolFailure } from "@/lib/ai/companion-tool-result";
import { mem0AddText } from "@/lib/ai/mem0-client";
import { chatOwnershipDenial } from "@/lib/ai/tool-policy";
import { getChatById, saveMemoryRecord } from "@/lib/db/queries";

export function saveMemory({
  userId,
  chatId,
}: {
  userId: string;
  chatId: string;
}) {
  return tool({
    description:
      "Save something to memory. Use when the user says 'remember this', shares a preference, states a goal, makes a decision, or tells you a fact worth keeping. Ask before saving unless the user explicitly requests it.",
    inputSchema: z.object({
      kind: z
        .enum(["note", "fact", "goal", "opportunity"])
        .describe(
          "What type of memory: note (general), fact (about the user), goal (something they want), opportunity (a connection you spotted)"
        ),
      content: z
        .string()
        .describe(
          "The memory content — a clear, standalone summary that will make sense when recalled later without conversation context"
        ),
      metadata: z
        .record(z.unknown())
        .optional()
        .describe("Optional structured data (tags, related IDs, dates)"),
    }),
    execute: async (input) => {
      try {
        const chat = await getChatById({ id: chatId });
        const denial = chatOwnershipDenial(chat, userId);
        if (denial) {
          return companionToolFailure({
            error: "companion_save_memory_denied",
            errorCode: "save_memory_chat_access_denied",
            retryable: false,
            message: denial,
          });
        }

        const record = await saveMemoryRecord({
          userId,
          chatId,
          kind: input.kind,
          content: input.content,
          metadata: input.metadata,
        });

        mem0AddText(input.content, userId, {
          kind: input.kind,
          chatId,
          ...(input.metadata ?? {}),
        }).catch(() => undefined);

        return {
          success: true,
          memoryId: record.id,
          message: `Saved to memory as ${input.kind}.`,
        };
      } catch (e) {
        const msg = e instanceof Error ? e.message : "unknown_error";
        return companionToolFailure({
          error: "companion_save_memory_failed",
          errorCode: "save_memory_persist_failed",
          retryable: true,
          message: `Could not save memory: ${msg}`,
        });
      }
    },
  });
}
