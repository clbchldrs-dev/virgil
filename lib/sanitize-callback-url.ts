/**
 * Restrict post-login redirects to same-origin paths (open redirect hardening).
 */
export function sanitizeAppCallbackUrl(raw: string | null | undefined): string {
  if (!raw) {
    return "/";
  }
  let decoded = raw;
  try {
    decoded = decodeURIComponent(raw);
  } catch {
    return "/";
  }
  if (!decoded.startsWith("/") || decoded.startsWith("//")) {
    return "/";
  }
  return decoded;
}
