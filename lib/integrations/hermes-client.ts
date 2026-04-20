import {
  getHermesExecutePath,
  getHermesHealthPath,
  getHermesHttpOrigin,
  getHermesSharedSecret,
  getHermesSkillsPath,
} from "@/lib/integrations/hermes-config";
import type { ClawIntent, ClawResult } from "@/lib/integrations/openclaw-types";

const FETCH_TIMEOUT_MS = 8000;
const MAX_ERROR_LENGTH = 500;

function fetchHermesWithTimeout(
  url: string,
  init?: RequestInit,
  timeoutMs: number = FETCH_TIMEOUT_MS
): Promise<Response> {
  return fetch(url, {
    ...init,
    signal: AbortSignal.timeout(timeoutMs),
  });
}

function fetchWithTimeout(url: string, init?: RequestInit): Promise<Response> {
  return fetchHermesWithTimeout(url, init, FETCH_TIMEOUT_MS);
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

function parseSkillName(raw: unknown): string | null {
  if (typeof raw === "string") {
    const trimmed = raw.trim();
    return trimmed.length > 0 ? trimmed : null;
  }
  if (typeof raw === "object" && raw !== null) {
    const record = raw as { id?: unknown; name?: unknown; slug?: unknown };
    const maybeId = record.id;
    const maybeName = record.name;
    const maybeSlug = record.slug;
    for (const value of [maybeId, maybeName, maybeSlug]) {
      if (typeof value === "string") {
        const trimmed = value.trim();
        if (trimmed.length > 0) {
          return trimmed;
        }
      }
    }
  }
  return null;
}

function normalizeSkillNames(payload: unknown): string[] {
  const values: unknown[] = [];
  if (Array.isArray(payload)) {
    values.push(...payload);
  } else if (typeof payload === "object" && payload !== null) {
    const skills = "skills" in payload ? payload.skills : undefined;
    if (Array.isArray(skills)) {
      values.push(...skills);
    }
  }

  const deduped = new Set<string>();
  for (const value of values) {
    const skillName = parseSkillName(value);
    if (skillName) {
      deduped.add(skillName);
    }
  }
  return [...deduped];
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

export async function sendHermesIntent(
  intent: ClawIntent,
  options?: { timeoutMs?: number }
): Promise<ClawResult> {
  const base = getHermesHttpOrigin();
  const executedAt = new Date().toISOString();
  if (!base) {
    return {
      success: false,
      error: "Hermes HTTP base URL is not configured.",
      errorCode: "not_configured",
      skill: intent.skill,
      executedAt,
    };
  }
  const executePath = getHermesExecutePath();
  const timeoutMs = options?.timeoutMs ?? FETCH_TIMEOUT_MS;
  try {
    const res = await fetchHermesWithTimeout(
      `${base}${executePath}`,
      {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
          ...buildAuthHeaders(),
        },
        body: JSON.stringify(intent),
      },
      timeoutMs
    );
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
        errorCode: "primary_unreachable",
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
        error instanceof Error
          ? truncateError(error.message)
          : "Request failed",
      errorCode: "primary_unreachable",
      skill: intent.skill,
      executedAt,
    };
  }
}

export async function listHermesSkillNames(): Promise<string[]> {
  const base = getHermesHttpOrigin();
  if (!base) {
    return [];
  }
  const skillsPath = getHermesSkillsPath();
  try {
    const res = await fetchWithTimeout(`${base}${skillsPath}`, {
      method: "GET",
      headers: {
        Accept: "application/json",
        ...buildAuthHeaders(),
      },
    });
    if (!res.ok) {
      return [];
    }
    const payload: unknown = await res.json();
    return normalizeSkillNames(payload);
  } catch {
    return [];
  }
}
