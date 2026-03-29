import "server-only";

/**
 * IronClaw-inspired allowlist for outbound HTTP from agent tools (SSRF / exfil guard).
 * Comma-separated hostnames in `AGENT_FETCH_ALLOWLIST_HOSTS`; defaults include Open-Meteo used by weather.
 */
const DEFAULT_HOSTS = ["geocoding-api.open-meteo.com", "api.open-meteo.com"];

function parseAllowlist(): string[] {
  const raw = process.env.AGENT_FETCH_ALLOWLIST_HOSTS?.trim();
  if (!raw) {
    return DEFAULT_HOSTS;
  }
  return raw
    .split(",")
    .map((h) => h.trim().toLowerCase())
    .filter(Boolean);
}

function hostnameAllowed(hostname: string, allowed: string[]): boolean {
  const h = hostname.toLowerCase();
  for (const entry of allowed) {
    if (h === entry) {
      return true;
    }
    if (h.endsWith(`.${entry}`)) {
      return true;
    }
  }
  return false;
}

/** Throws if the URL host is not on the allowlist (http/https only). */
export function assertAgentFetchUrlAllowed(urlString: string): void {
  let url: URL;
  try {
    url = new URL(urlString);
  } catch {
    throw new Error(`Invalid URL for agent fetch: ${urlString}`);
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw new Error(`URL scheme not allowed for agent fetch: ${url.protocol}`);
  }
  const allowed = parseAllowlist();
  if (!hostnameAllowed(url.hostname, allowed)) {
    throw new Error(
      `Hostname not allowlisted for agent fetch: ${url.hostname}. Set AGENT_FETCH_ALLOWLIST_HOSTS.`
    );
  }
}
