import { z } from "zod";

const alexaSlotSchema = z
  .object({
    name: z.string().optional(),
    value: z.string().optional(),
  })
  .passthrough();

const alexaIntentSchema = z
  .object({
    name: z.string().min(1),
    slots: z.record(alexaSlotSchema).optional(),
  })
  .passthrough();

const alexaRequestSchema = z
  .object({
    type: z.enum(["LaunchRequest", "IntentRequest", "SessionEndedRequest"]),
    intent: alexaIntentSchema.optional(),
  })
  .passthrough();

export const alexaRequestEnvelopeSchema = z
  .object({
    request: alexaRequestSchema,
    session: z
      .object({
        sessionId: z.string().optional(),
        user: z
          .object({
            userId: z.string().optional(),
          })
          .optional(),
      })
      .optional(),
  })
  .passthrough();

export type AlexaRequestEnvelope = z.infer<typeof alexaRequestEnvelopeSchema>;

const captureSlotPriority = ["note", "content", "text", "capture"] as const;

export function extractCaptureText(
  envelope: AlexaRequestEnvelope
): string | null {
  const slots = envelope.request.intent?.slots;
  if (!slots) {
    return null;
  }

  for (const key of captureSlotPriority) {
    const value = slots[key]?.value?.trim();
    if (value) {
      return value;
    }
  }

  for (const slot of Object.values(slots)) {
    const value = slot.value?.trim();
    if (value) {
      return value;
    }
  }

  return null;
}
