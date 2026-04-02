import { delegationNeedsConfirmation } from "@/lib/integrations/openclaw-match";
import type {
  ClawIntent,
  VirgilBridgeEvent,
} from "@/lib/integrations/openclaw-types";

type IntentBuilder = (event: VirgilBridgeEvent) => ClawIntent | null;

const nudgeText = (event: VirgilBridgeEvent): string => {
  const t = event.payload.nudgeText;
  return typeof t === "string" ? t : "";
};

export const OPENCLAW_EVENT_ACTIONS: Record<string, IntentBuilder> = {
  habit_stale: (event) => {
    const text = nudgeText(event);
    if (!text) {
      return null;
    }
    return {
      skill: "send-whatsapp",
      params: { to: "self", message: text },
      priority: "normal",
      source: "event-bus",
      requiresConfirmation: true,
    };
  },
  ticket_deadline_approaching: (event) => {
    const text = nudgeText(event);
    if (!text) {
      return null;
    }
    return {
      skill: "send-slack",
      params: { channel: "self", message: text },
      priority: "high",
      source: "event-bus",
      requiresConfirmation: false,
    };
  },
};

export function buildOpenClawIntentFromVirgilEvent(
  event: VirgilBridgeEvent
): ClawIntent | null {
  const builder = OPENCLAW_EVENT_ACTIONS[event.type];
  if (!builder) {
    return null;
  }
  const intent = builder(event);
  if (!intent) {
    return null;
  }
  if (
    !intent.requiresConfirmation &&
    delegationNeedsConfirmation(JSON.stringify(intent.params), intent.skill)
  ) {
    intent.requiresConfirmation = true;
  }
  return intent;
}
