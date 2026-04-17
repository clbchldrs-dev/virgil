import "server-only";

import { emailAllowlistFromCommaList } from "@/lib/passwordless-email-allowlist";

function truthyEnv(value: string | undefined): boolean {
  if (!value) {
    return false;
  }
  const normalized = value.trim().toLowerCase();
  return normalized === "1" || normalized === "true" || normalized === "yes";
}

/**
 * Email-only sign-in when `VIRGIL_PASSWORDLESS_LOGIN` is truthy and
 * `VIRGIL_PASSWORDLESS_EMAILS` is a non-empty comma-separated allowlist.
 * Anyone who can submit a login request as an allowed email becomes that user
 * — use only for trusted networks or single-owner deployments; prefer HTTPS.
 */
export function isPasswordlessLoginConfigured(): boolean {
  if (!truthyEnv(process.env.VIRGIL_PASSWORDLESS_LOGIN)) {
    return false;
  }
  const raw = process.env.VIRGIL_PASSWORDLESS_EMAILS?.trim() ?? "";
  return raw.length > 0;
}

export function parsePasswordlessEmailAllowlist(): Set<string> {
  return emailAllowlistFromCommaList(
    process.env.VIRGIL_PASSWORDLESS_EMAILS ?? ""
  );
}

export function isEmailAllowedForPasswordlessLogin(email: string): boolean {
  const normalized = email.trim().toLowerCase();
  return parsePasswordlessEmailAllowlist().has(normalized);
}
