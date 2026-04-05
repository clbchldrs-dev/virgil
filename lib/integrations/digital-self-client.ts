import { getDigitalSelfBaseUrl } from "./digital-self-config";

export type DigitalSelfHealthPayload = {
  ok?: boolean;
  service?: string;
  metrics?: Record<string, number>;
};

export async function pingDigitalSelfHealth(): Promise<
  | { configured: false }
  | {
      configured: true;
      reachable: boolean;
      status: number;
      payload: DigitalSelfHealthPayload | null;
    }
> {
  const base = getDigitalSelfBaseUrl();
  if (!base) {
    return { configured: false };
  }

  const response = await fetch(`${base}/health`, {
    method: "GET",
    cache: "no-store",
  });

  let payload: DigitalSelfHealthPayload | null = null;
  try {
    payload = (await response.json()) as DigitalSelfHealthPayload;
  } catch {
    payload = null;
  }

  return {
    configured: true,
    reachable: response.ok,
    status: response.status,
    payload,
  };
}
