import type { InboundMessage } from "./schemas.js";

export type InboundIntent =
  | "urgent"
  | "noise"
  | "requires_response"
  | "delegate"
  | "defer";

export type IntentClassification = {
  intent: InboundIntent;
  confidence: number;
  notes: string[];
};

const URGENT = /\b(urgent|asap|emergency|now\b|immediately|911)\b/i;
const NOISE = /^(lol|haha|👍|✅|k\.?|kk)\s*$/i;
const DELEGATE = /\b(can you (handle|take care|own)|delegate|loop in)\b/i;

export function classifyInboundIntent(
  message: InboundMessage
): IntentClassification {
  const text = message.bodyText.trim();
  const notes: string[] = [];

  if (URGENT.test(text)) {
    notes.push("Urgency markers detected.");
    return { intent: "urgent", confidence: 0.72, notes };
  }
  if (NOISE.test(text)) {
    notes.push("Short reaction / low content.");
    return { intent: "noise", confidence: 0.65, notes };
  }
  if (DELEGATE.test(text)) {
    notes.push("Delegation language.");
    return { intent: "delegate", confidence: 0.58, notes };
  }
  if (text.endsWith("?")) {
    notes.push("Question-shaped message.");
    return { intent: "requires_response", confidence: 0.55, notes };
  }
  if (text.length < 12) {
    notes.push("Very short message; likely deferrable.");
    return { intent: "defer", confidence: 0.45, notes };
  }
  notes.push("Default: treat as needing a response.");
  return { intent: "requires_response", confidence: 0.5, notes };
}
