/**
 * OpenClaw is optional. When unset, delegation tools stay unregistered.
 */
export function isOpenClawConfigured(): boolean {
  return Boolean(
    process.env.OPENCLAW_URL?.trim() || process.env.OPENCLAW_HTTP_URL?.trim()
  );
}

function normalizeOpenClawOrigin(raw: string): string | null {
  try {
    const parsed = new URL(raw.trim());
    if (parsed.protocol === "ws:") {
      parsed.protocol = "http:";
    } else if (parsed.protocol === "wss:") {
      parsed.protocol = "https:";
    }
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return null;
    }
    return parsed.origin;
  } catch {
    return null;
  }
}

/**
 * HTTP origin for REST calls. Prefer OPENCLAW_HTTP_URL; else derive from OPENCLAW_URL (ws/wss → http/https).
 */
export function getOpenClawHttpOrigin(): string | null {
  const explicit = process.env.OPENCLAW_HTTP_URL?.trim();
  if (explicit) {
    return normalizeOpenClawOrigin(explicit);
  }
  const ws = process.env.OPENCLAW_URL?.trim();
  if (!ws) {
    return null;
  }
  return normalizeOpenClawOrigin(ws);
}

export function getOpenClawExecutePath(): string {
  return process.env.OPENCLAW_EXECUTE_PATH?.trim() || "/api/execute";
}

export function getOpenClawSkillsPath(): string {
  return process.env.OPENCLAW_SKILLS_PATH?.trim() || "/api/skills";
}

export function getOpenClawHealthPath(): string {
  return process.env.OPENCLAW_HEALTH_PATH?.trim() || "/health";
}

/** True when delegation targets the Gateway's `POST /tools/invoke` surface (no legacy GET skill catalog). */
export function usesOpenClawToolsInvokePath(): boolean {
  if (process.env.OPENCLAW_GATEWAY_TOOLS_INVOKE?.trim() === "1") {
    return true;
  }
  return getOpenClawExecutePath().toLowerCase().includes("tools/invoke");
}

/**
 * Comma-separated tool/skill ids merged with GET `OPENCLAW_SKILLS_PATH` results.
 * Use when the gateway only exposes `POST /tools/invoke` and has no JSON skills route
 * (GET default `/api/skills` returns 404 on current OpenClaw Gateway).
 */
export function getOpenClawStaticSkillNames(): string[] {
  const raw = process.env.OPENCLAW_SKILLS_STATIC?.trim();
  if (!raw) {
    return [];
  }
  return [
    ...new Set(
      raw
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean)
    ),
  ].sort();
}

export function mergeOpenClawSkillNameLists(...lists: string[][]): string[] {
  const out = new Set<string>();
  for (const list of lists) {
    for (const id of list) {
      const t = id.trim();
      if (t) {
        out.add(t);
      }
    }
  }
  return [...out].sort();
}
