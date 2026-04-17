import {
  getHermesExecutePath,
  getHermesHealthPath,
  getHermesHttpOrigin,
  getHermesSharedSecret,
} from "@/lib/integrations/hermes-config";
import type { ClawIntent, ClawResult } from "@/lib/integrations/openclaw-types";

const FETCH_TIMEOUT_MS = 8000;
const MAX_ERROR_LENGTH = 500;

function fetchWithTimeout(url: string, init?: RequestInit): Promise<Response> {
  return fetch(url, {
    ...init,
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });
}

function buildAuthHeaders(): Record<string, string> {
  const sharedSecret = getHermesSharedSecret();
  if (!sharedSecret) {
    return {};
  }
  return { Authorization: `Bearer ${sharedSecret}` };
}

function truncateError(msg: string): string {
  const stripped = msg.replace(/<[^>]*>/g, "");
  return stripped.length > MAX_ERROR_LENGTH
    ? `${stripped.slice(0, MAX_ERROR_LENGTH)}…`
    : stripped;
}

export async function pingHermes(): Promise<boolean> {
  const base = getHermesHttpOrigin();
  if (!base) {
    return false;
  }
  const healthPath = getHermesHealthPath();
  try {
    const res = await fetchWithTimeout(`${base}${healthPath}`, {
      method: "GET",
      headers: {
        Accept: "application/json",
        ...buildAuthHeaders(),
      },
    });
    return res.ok;
  } catch {
    return false;
  }
}

export async function sendHermesIntent(intent: ClawIntent): Promise<ClawResult> {
  const base = getHermesHttpOrigin();
  const executedAt = new Date().toISOString();
  if (!base) {
    return {
      success: false,
      error: "Hermes HTTP base URL is not configured.",
      skill: intent.skill,
      executedAt,
    };
  }
  const executePath = getHermesExecutePath();
  try {
    const res = await fetchWithTimeout(`${base}${executePath}`, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        ...buildAuthHeaders(),
      },
      body: JSON.stringify(intent),
    });
    const text = await res.text();
    let output: string | undefined;
    if (text) {
      try {
        const parsed: unknown = JSON.parse(text);
        output =
          typeof parsed === "object" && parsed !== null && "output" in parsed
            ? String((parsed as { output: unknown }).output)
            : text;
      } catch {
        output = text;
      }
    }
    if (!res.ok) {
      return {
        success: false,
        error: truncateError(output ?? `HTTP ${String(res.status)}`),
        skill: intent.skill,
        executedAt,
      };
    }
    return {
      success: true,
      output,
      skill: intent.skill,
      executedAt,
    };
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof Error ? truncateError(error.message) : "Request failed",
      skill: intent.skill,
      executedAt,
    };
  }
}
