import { z } from "zod";
import type { InboundMessage } from "../core/schemas.js";

const urlVerificationSchema = z.object({
  type: z.literal("url_verification"),
  challenge: z.string(),
});

const messageEventSchema = z.object({
  type: z.literal("event_callback"),
  event: z.object({
    type: z.literal("message"),
    channel: z.string(),
    user: z.string().optional(),
    text: z.string().optional(),
    ts: z.string(),
    subtype: z.string().optional(),
  }),
});

export type SlackParseResult =
  | { kind: "url_verification"; challenge: string }
  | { kind: "message"; message: InboundMessage }
  | { kind: "ignored"; reason: string };

export function parseSlackEventPayload(raw: string): SlackParseResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw) as unknown;
  } catch {
    return { kind: "ignored", reason: "invalid_json" };
  }

  const urlCheck = urlVerificationSchema.safeParse(parsed);
  if (urlCheck.success) {
    return { kind: "url_verification", challenge: urlCheck.data.challenge };
  }

  const msgCheck = messageEventSchema.safeParse(parsed);
  if (!msgCheck.success) {
    return { kind: "ignored", reason: "unsupported_event" };
  }

  const { event } = msgCheck.data;
  if (event.subtype && event.subtype !== "thread_broadcast") {
    return { kind: "ignored", reason: `subtype_${event.subtype}` };
  }
  const text = event.text ?? "";
  const senderId = event.user ?? "unknown";
  const message: InboundMessage = {
    channel: "slack",
    externalThreadId: event.channel,
    externalMessageId: event.ts,
    senderId,
    bodyText: text,
    receivedAt: new Date().toISOString(),
    rawMetadata: { slack: msgCheck.data },
  };
  return { kind: "message", message };
}
