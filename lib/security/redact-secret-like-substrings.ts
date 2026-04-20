/**
 * Strips patterns that often carry credentials before strings are shown to users,
 * echoed in tool results, or included in operator exports. Not a full DLP solution.
 */
export function redactSecretLikeSubstrings(input: string): string {
  let s = input;
  s = s.replace(/\bBearer\s+[A-Za-z0-9._\-+/=~]{8,}\b/gi, "Bearer [redacted]");
  s = s.replace(/([a-z][a-z+.-]*):\/\/[^@\s#]+@/gi, "$1://[redacted]@");
  return s;
}
