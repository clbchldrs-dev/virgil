function normalizeHttpOrigin(raw: string): string | null {
  try {
    const parsed = new URL(raw.trim());
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return null;
    }
    return parsed.origin;
  } catch {
    return null;
  }
}

/**
 * Default origin for the in-app Hermes bridge (same Next.js process).
 *
 * Preference order:
 *  1. VERCEL_URL (production / preview deploys)
 *  2. NEXT_PUBLIC_APP_URL (explicit override)
 *  3. http://127.0.0.1:${PORT ?? 3000}  (local dev default)
 */
function inAppBridgeOrigin(): string {
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`;
  }
  if (process.env.NEXT_PUBLIC_APP_URL) {
    const normalized = normalizeHttpOrigin(process.env.NEXT_PUBLIC_APP_URL);
    if (normalized) {
      return normalized;
    }
  }
  const port = process.env.PORT?.trim() || "3000";
  return `http://127.0.0.1:${port}`;
}

/**
 * Explicit `HERMES_HTTP_URL` always wins (useful for pointing at a remote
 * Hermes instance). When unset, Virgil uses the in-app bridge at
 * `app/api/hermes-bridge/*` in the same Next.js process.
 */
export function getHermesHttpOrigin(): string | null {
  const raw = process.env.HERMES_HTTP_URL?.trim();
  if (raw) {
    return normalizeHttpOrigin(raw);
  }
  return inAppBridgeOrigin();
}

/** True when the bridge is reachable (in-app default counts as configured). */
export function isHermesConfigured(): boolean {
  return getHermesHttpOrigin() !== null;
}

export function getHermesExecutePath(): string {
  return (
    process.env.HERMES_EXECUTE_PATH?.trim() || "/api/hermes-bridge/execute"
  );
}

export function getHermesPendingPath(): string {
  return (
    process.env.HERMES_PENDING_PATH?.trim() || "/api/hermes-bridge/pending"
  );
}

export function getHermesSkillsPath(): string {
  return process.env.HERMES_SKILLS_PATH?.trim() || "/api/hermes-bridge/skills";
}

export function getHermesHealthPath(): string {
  return process.env.HERMES_HEALTH_PATH?.trim() || "/api/hermes-bridge/health";
}

export function getHermesSharedSecret(): string | null {
  const raw = process.env.HERMES_SHARED_SECRET?.trim();
  return raw ? raw : null;
}
