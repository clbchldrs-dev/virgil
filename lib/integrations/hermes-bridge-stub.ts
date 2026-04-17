import { getHermesSharedSecret } from "@/lib/integrations/hermes-config";

type HermesIntentLike = {
  skill?: string;
  params?: Record<string, unknown>;
};

function readDescription(params: Record<string, unknown> | undefined): string {
  const description = params?.description;
  if (typeof description === "string" && description.trim().length > 0) {
    return description.trim();
  }
  return "No description provided";
}

export function hermesBridgeStubEnabled(): boolean {
  return process.env.VIRGIL_HERMES_BRIDGE_STUB_ENABLED === "1";
}

export function isHermesBridgeRequestAuthorized(request: Request): boolean {
  const sharedSecret = getHermesSharedSecret();
  if (!sharedSecret) {
    return true;
  }
  return request.headers.get("authorization") === `Bearer ${sharedSecret}`;
}

export function buildHermesStubOutput(intent: HermesIntentLike): string {
  const skill = intent.skill?.trim() || "unknown-skill";
  const description = readDescription(intent.params);
  return `[Hermes bridge stub] accepted intent '${skill}'. Description: ${description}`;
}
