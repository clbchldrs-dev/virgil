import { z } from "zod";
import type { InboundMessage } from "../core/schemas.js";

const twilioFormSchema = z.object({
  MessageSid: z.string(),
  From: z.string(),
  Body: z.string().optional(),
});

export type TwilioParseResult =
  | { kind: "message"; message: InboundMessage }
  | { kind: "ignored"; reason: string };

export function parseTwilioSmsForm(params: URLSearchParams): TwilioParseResult {
  const record: Record<string, string> = {};
  for (const [key, value] of params.entries()) {
    record[key] = value;
  }
  const check = twilioFormSchema.safeParse(record);
  if (!check.success) {
    return { kind: "ignored", reason: "invalid_form" };
  }
  const message: InboundMessage = {
    channel: "sms",
    externalThreadId: check.data.From,
    externalMessageId: check.data.MessageSid,
    senderId: check.data.From,
    bodyText: check.data.Body ?? "",
    receivedAt: new Date().toISOString(),
    rawMetadata: { twilio: check.data },
  };
  return { kind: "message", message };
}
