import { Client } from "@upstash/qstash";
import { tool } from "ai";
import { z } from "zod";
import { chatOwnershipDenial } from "@/lib/ai/tool-policy";
import { getChatById } from "@/lib/db/queries";

function getQStash() {
  const token = process.env.QSTASH_TOKEN;
  if (!token) {
    throw new Error("QSTASH_TOKEN is not set");
  }
  return new Client({ token });
}

function getBaseUrl(): string {
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`;
  }
  return process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
}

export function setReminder({
  userId,
  chatId,
}: {
  userId: string;
  chatId: string;
}) {
  return tool({
    description:
      "Set a reminder for the user. They will receive an email when it fires. Use when the user says 'remind me', 'don't let me forget', or describes something time-sensitive they want to follow up on.",
    inputSchema: z.object({
      message: z
        .string()
        .describe(
          "The reminder message — what should the user be reminded about"
        ),
      deliverAt: z
        .string()
        .describe(
          "ISO 8601 timestamp for when to deliver the reminder (e.g. '2026-04-01T09:00:00Z')"
        ),
    }),
    needsApproval: true,
    execute: async (input) => {
      const chat = await getChatById({ id: chatId });
      const denial = chatOwnershipDenial(chat, userId);
      if (denial) {
        return { success: false as const, message: denial };
      }

      const deliverTime = new Date(input.deliverAt);
      const now = new Date();
      if (deliverTime <= now) {
        return {
          success: false,
          message: "Reminder time must be in the future.",
        };
      }

      const delaySeconds = Math.floor(
        (deliverTime.getTime() - now.getTime()) / 1000
      );

      // #region agent log
      {
        const rawUrl = process.env.QSTASH_URL;
        let qstashHost: string | null = null;
        if (rawUrl) {
          try {
            qstashHost = new URL(rawUrl).hostname;
          } catch {
            qstashHost = "invalid_url";
          }
        }
        fetch(
          "http://127.0.0.1:7838/ingest/7925a257-7797-4a8d-9c5b-1a308b2155f1",
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "X-Debug-Session-Id": "7813dc",
            },
            body: JSON.stringify({
              sessionId: "7813dc",
              hypothesisId: "H5",
              location: "lib/ai/tools/set-reminder.ts:pre-publish",
              message: "QStash env before publishJSON",
              data: {
                hasQstashUrl: Boolean(rawUrl),
                qstashHost,
                delaySeconds,
                baseUrlHost: (() => {
                  try {
                    return new URL(getBaseUrl()).hostname;
                  } catch {
                    return "invalid";
                  }
                })(),
              },
              timestamp: Date.now(),
            }),
          }
        ).catch(() => {
          /* debug ingest optional */
        });
      }
      // #endregion

      await getQStash().publishJSON({
        url: `${getBaseUrl()}/api/reminders`,
        body: {
          userId,
          chatId,
          message: input.message,
          scheduledFor: input.deliverAt,
        },
        delay: delaySeconds,
      });

      return {
        success: true,
        message: `Reminder set for ${deliverTime.toLocaleString()}. You'll get an email.`,
        deliverAt: input.deliverAt,
      };
    },
  });
}
