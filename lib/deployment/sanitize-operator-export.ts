import { redactSecretLikeSubstrings } from "@/lib/security/redact-secret-like-substrings";

/** Recursively redact secret-like substrings in string leaves (operator JSON export). */
export function sanitizeOperatorExportDeep(value: unknown): unknown {
  if (value === null || value === undefined) {
    return value;
  }
  if (typeof value === "string") {
    return redactSecretLikeSubstrings(value);
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return value;
  }
  if (Array.isArray(value)) {
    return value.map(sanitizeOperatorExportDeep);
  }
  if (typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = sanitizeOperatorExportDeep(v);
    }
    return out;
  }
  return value;
}
