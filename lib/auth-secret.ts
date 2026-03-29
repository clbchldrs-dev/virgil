import {
  isDevelopmentEnvironment,
  isProductionEnvironment,
  isTestEnvironment,
} from "./constants";

/**
 * Values from the environment only (no fallback). Use when you must know if
 * the operator configured a real secret.
 */
export function getAuthSecret(): string | undefined {
  return process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET;
}

/**
 * **Never use in production traffic** — predictable; only for `next dev` /
 * tests when no `AUTH_SECRET` is set.
 */
const DEV_INSECURE_AUTH_SECRET =
  "local-dev-only-insecure-auth-secret-do-not-deploy";

let devFallbackWarned = false;

export const AUTH_SECRET_SETUP_HINT =
  "Add AUTH_SECRET to .env.local (run: openssl rand -base64 32). See AGENTS.md § Step 1.1. Required for production builds and deploys.";

/**
 * Secret passed to `NextAuth()` and `getToken()`.
 *
 * - **Production** (`NODE_ENV=production`): requires `AUTH_SECRET` or
 *   `NEXTAUTH_SECRET`, or throws (so misconfigured deploys fail loudly).
 * - **Development / test**: uses env if set; otherwise a fixed insecure
 *   fallback and a one-time console warning (so `pnpm dev` works before
 *   `.env.local` is complete).
 */
export function getAuthSecretResolved(): string {
  const fromEnv = getAuthSecret();
  if (fromEnv) {
    return fromEnv;
  }

  if (isProductionEnvironment) {
    throw new Error(
      `AUTH_SECRET is required when NODE_ENV=production (e.g. next build, next start, Vercel). ${AUTH_SECRET_SETUP_HINT}`
    );
  }

  if (isDevelopmentEnvironment || isTestEnvironment) {
    if (isDevelopmentEnvironment && !devFallbackWarned) {
      console.warn(
        "\n[auth] AUTH_SECRET / NEXTAUTH_SECRET not set — using an insecure dev-only JWT secret.\n" +
          "        Set AUTH_SECRET in .env.local before storing real data or deploying.\n"
      );
      devFallbackWarned = true;
    }
    return DEV_INSECURE_AUTH_SECRET;
  }

  throw new Error(
    `AUTH_SECRET is required (unknown NODE_ENV=${process.env.NODE_ENV ?? "undefined"}). ${AUTH_SECRET_SETUP_HINT}`
  );
}
