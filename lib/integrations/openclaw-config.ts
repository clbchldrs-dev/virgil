/**
 * OpenClaw is optional. When unset, delegation tools stay unregistered.
 */
export function isOpenClawConfigured(): boolean {
  return Boolean(
    process.env.OPENCLAW_URL?.trim() || process.env.OPENCLAW_HTTP_URL?.trim()
  );
}

/**
 * HTTP origin for REST calls. Prefer OPENCLAW_HTTP_URL; else derive from OPENCLAW_URL (ws/wss → http/https).
 */
export function getOpenClawHttpOrigin(): string | null {
  const explicit = process.env.OPENCLAW_HTTP_URL?.trim();
  if (explicit) {
    return explicit.replace(/\/$/u, "");
  }
  const ws = process.env.OPENCLAW_URL?.trim();
  if (!ws) {
    return null;
  }
  try {
    const u = new URL(ws);
    u.protocol = u.protocol === "wss:" ? "https:" : "http:";
    return u.origin;
  } catch {
    return null;
  }
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
