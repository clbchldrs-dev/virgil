/** Comma-separated email allowlist for passwordless login (normalized for lookup). */
export function emailAllowlistFromCommaList(raw: string): Set<string> {
  return new Set(
    raw
      .split(",")
      .map((part) => part.trim().toLowerCase())
      .filter((part) => part.length > 0)
  );
}
