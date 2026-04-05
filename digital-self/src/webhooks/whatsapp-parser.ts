import { z } from "zod";
import type { InboundMessage } from "../core/schemas.js";

const textMessageSchema = z.object({
  object: z.literal("whatsapp_business_account"),
  entry: z.array(
    z.object({
      changes: z.array(
        z.object({
          value: z.object({
            messages: z
              .array(
                z.object({
                  id: z.string(),
                  from: z.string(),
                  type: z.string(),
                  text: z
                    .object({
                      body: z.string(),
                    })
                    .optional(),
                })
              )
              .optional(),
          }),
        })
      ),
    })
  ),
});

export type WhatsAppParseResult =
  | { kind: "message"; message: InboundMessage }
  | { kind: "ignored"; reason: string };

export function parseWhatsAppWebhookPayload(raw: string): WhatsAppParseResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw) as unknown;
  } catch {
    return { kind: "ignored", reason: "invalid_json" };
  }

  const check = textMessageSchema.safeParse(parsed);
  if (!check.success) {
    return { kind: "ignored", reason: "unsupported_payload" };
  }

  const msg = check.data.entry.at(0)?.changes.at(0)?.value.messages?.at(0);
  if (!msg || msg.type !== "text" || !msg.text?.body) {
    return { kind: "ignored", reason: "no_text_message" };
  }

  const message: InboundMessage = {
    channel: "whatsapp",
    externalThreadId: msg.from,
    externalMessageId: msg.id,
    senderId: msg.from,
    bodyText: msg.text.body,
    receivedAt: new Date().toISOString(),
    rawMetadata: { whatsapp: check.data },
  };
  return { kind: "message", message };
}
