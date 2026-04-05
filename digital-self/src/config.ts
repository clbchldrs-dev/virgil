import { z } from "zod";

const envSchema = z.object({
  PORT: z.coerce.number().int().positive().default(8790),
  DIGITAL_SELF_INGEST_SECRET: z.string().min(8),
  DIGITAL_SELF_SERVICE_TOKEN: z.string().min(8),
  SLACK_SIGNING_SECRET: z.string().optional(),
  WHATSAPP_APP_SECRET: z.string().optional(),
  WHATSAPP_VERIFY_TOKEN: z.string().optional(),
  TWILIO_AUTH_TOKEN: z.string().optional(),
  VIRGIL_BRIDGE_WEBHOOK_URL: z.string().url().optional(),
  VIRGIL_BRIDGE_WEBHOOK_SECRET: z.string().optional(),
});

export type DigitalSelfEnv = z.infer<typeof envSchema>;

export function loadEnv(raw: NodeJS.ProcessEnv): DigitalSelfEnv {
  const parsed = envSchema.safeParse(raw);
  if (!parsed.success) {
    const message = parsed.error.flatten().fieldErrors;
    throw new Error(`Invalid env: ${JSON.stringify(message)}`);
  }
  return parsed.data;
}
