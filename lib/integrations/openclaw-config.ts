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
