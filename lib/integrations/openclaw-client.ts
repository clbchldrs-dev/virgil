import {
  getOpenClawExecutePath,
  getOpenClawHealthPath,
  getOpenClawHttpOrigin,
  getOpenClawSkillsPath,
  getOpenClawStaticSkillNames,
  mergeOpenClawSkillNameLists,
} from "@/lib/integrations/openclaw-config";
import {
  buildOpenClawGatewayInvokeBody,
  formatOpenClawGatewayResultPayload,
  isOpenClawGatewayExecutePath,
  openClawGatewayAuthHeaders,
} from "@/lib/integrations/openclaw-gateway";
import type { ClawIntent, ClawResult } from "@/lib/integrations/openclaw-types";

const FETCH_TIMEOUT_MS = 8000;
const MAX_ERROR_LENGTH = 500;

function truncateError(msg: string): string {
  const stripped = msg.replace(/<[^>]*>/g, "");
  return stripped.length > MAX_ERROR_LENGTH
    ? `${stripped.slice(0, MAX_ERROR_LENGTH)}…`
    : stripped;
}

export function fetchOpenClawWithTimeout(
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
  return fetchOpenClawWithTimeout(url, init, FETCH_TIMEOUT_MS);
}

export async function pingOpenClaw(): Promise<boolean> {
  const base = getOpenClawHttpOrigin();
  if (!base) {
    return false;
  }
  const healthPath = getOpenClawHealthPath();
  try {
    const res = await fetchWithTimeout(`${base}${healthPath}`, {
      method: "GET",
      headers: { Accept: "application/json" },
    });
    return res.ok;
  } catch {
    try {
      const res = await fetchWithTimeout(`${base}/api/health`, {
        method: "GET",
      });
      return res.ok;
    } catch {
      return false;
    }
  }
}

export async function listOpenClawSkills(): Promise<string[]> {
  const staticNames = getOpenClawStaticSkillNames();
  const base = getOpenClawHttpOrigin();
  if (!base) {
    return staticNames;
  }
  const path = getOpenClawSkillsPath();
  try {
    const res = await fetchWithTimeout(`${base}${path}`, {
      method: "GET",
      headers: openClawGatewayAuthHeaders(),
    });
    if (!res.ok) {
      return staticNames;
    }
    const data: unknown = await res.json();
    let fromResponse: string[] = [];
    if (Array.isArray(data)) {
      fromResponse = data.filter((x): x is string => typeof x === "string");
    } else if (
      data &&
      typeof data === "object" &&
      "skills" in data &&
      Array.isArray((data as { skills: unknown }).skills)
    ) {
      fromResponse = (data as { skills: unknown[] }).skills.filter(
        (x): x is string => typeof x === "string"
      );
    }
    return mergeOpenClawSkillNameLists(fromResponse, staticNames);
  } catch {
    return staticNames;
  }
}

let skillsCache: { skills: string[]; at: number } | null = null;
const SKILLS_CACHE_MS = 5 * 60 * 1000;

export async function getCachedOpenClawSkillNames(): Promise<string[]> {
  const now = Date.now();
  if (skillsCache && now - skillsCache.at < SKILLS_CACHE_MS) {
    return skillsCache.skills;
  }
  const skills = await listOpenClawSkills();
  skillsCache = { skills, at: now };
  return skills;
}

export async function sendOpenClawIntent(
  intent: ClawIntent,
  options?: { timeoutMs?: number }
): Promise<ClawResult> {
  const base = getOpenClawHttpOrigin();
  const executedAt = new Date().toISOString();
  if (!base) {
    return {
      success: false,
      error: "OpenClaw HTTP base URL is not configured.",
      errorCode: "not_configured",
      skill: intent.skill,
      executedAt,
    };
  }
  const path = getOpenClawExecutePath();
  const timeoutMs = options?.timeoutMs ?? FETCH_TIMEOUT_MS;
  const gateway = isOpenClawGatewayExecutePath();
  try {
    const res = await fetchOpenClawWithTimeout(
      `${base}${path}`,
      {
        method: "POST",
        headers: {
          ...(gateway ? openClawGatewayAuthHeaders() : {}),
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        body: gateway
          ? buildOpenClawGatewayInvokeBody(intent)
          : JSON.stringify(intent),
      },
      timeoutMs
    );
    const text = await res.text();
    let output: string | undefined;
    if (text) {
      if (gateway) {
        output = formatOpenClawGatewayResultPayload(text);
      } else {
        try {
          const j: unknown = JSON.parse(text);
          output =
            typeof j === "object" && j !== null && "output" in j
              ? String((j as { output: unknown }).output)
              : text;
        } catch {
          output = text;
        }
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
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? truncateError(e.message) : "Request failed",
      errorCode: "primary_unreachable",
      skill: intent.skill,
      executedAt,
    };
  }
}
