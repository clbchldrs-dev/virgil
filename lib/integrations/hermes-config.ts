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

export function getHermesHttpOrigin(): string | null {
  const raw = process.env.HERMES_HTTP_URL?.trim();
  if (!raw) {
    return null;
  }
  return normalizeHttpOrigin(raw);
}

export function isHermesConfigured(): boolean {
  return getHermesHttpOrigin() !== null;
}

export function getHermesExecutePath(): string {
  return process.env.HERMES_EXECUTE_PATH?.trim() || "/api/execute";
}

export function getHermesPendingPath(): string {
  return process.env.HERMES_PENDING_PATH?.trim() || "/api/pending";
}

export function getHermesHealthPath(): string {
  return process.env.HERMES_HEALTH_PATH?.trim() || "/health";
}

export function getHermesSharedSecret(): string | null {
  const raw = process.env.HERMES_SHARED_SECRET?.trim();
  return raw ? raw : null;
}
