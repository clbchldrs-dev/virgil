import { generateDummyPassword } from "./db/utils";

export const isProductionEnvironment = process.env.NODE_ENV === "production";
export const isDevelopmentEnvironment = process.env.NODE_ENV === "development";
export const isTestEnvironment = Boolean(
  process.env.PLAYWRIGHT_TEST_BASE_URL ||
    process.env.PLAYWRIGHT ||
    process.env.CI_PLAYWRIGHT
);

/**
 * Must match Auth.js cookie naming (`__Secure-` prefix only when true).
 * Production over plain HTTP (e.g. Docker Desktop) needs `false`, or `getToken`
 * looks for the wrong cookie and the proxy guest-redirect loops.
 */
export function shouldUseSecureAuthCookie(): boolean {
  const explicit = process.env.AUTH_COOKIE_SECURE?.toLowerCase();
  if (explicit === "false" || explicit === "0") {
    return false;
  }
  if (explicit === "true" || explicit === "1") {
    return true;
  }
  const authUrl = process.env.AUTH_URL ?? process.env.NEXTAUTH_URL ?? "";
  try {
    if (authUrl) {
      const { protocol } = new URL(authUrl);
      if (protocol === "http:") {
        return false;
      }
      if (protocol === "https:") {
        return true;
      }
    }
  } catch {
    /* ignore invalid AUTH_URL */
  }
  return !isDevelopmentEnvironment;
}

export const guestRegex = /^guest-\d+$/;

export const DUMMY_PASSWORD = generateDummyPassword();

export type { ChatEmptySuggestion } from "./empty-suggestion-pools";
