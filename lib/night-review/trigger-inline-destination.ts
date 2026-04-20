import { isIPv4, isIPv6 } from "node:net";

/**
 * QStash cannot POST to loopback or common private LAN addresses. When
 * `getBaseUrl()` points at such a host, manual trigger runs the worker in-process
 * instead of publishing (local dev, homelab, etc.).
 */
export function shouldRunNightReviewTriggerInline(baseUrl: string): boolean {
  try {
    const { hostname } = new URL(baseUrl);
    const h = hostname.replace(/^\[|\]$/g, "");

    if (h === "localhost") {
      return true;
    }

    if (isIPv4(h)) {
      if (h.startsWith("127.")) {
        return true;
      }
      if (h === "0.0.0.0") {
        return true;
      }
      if (h.startsWith("10.")) {
        return true;
      }
      if (h.startsWith("192.168.")) {
        return true;
      }
      if (h.startsWith("172.")) {
        const parts = h.split(".");
        if (parts.length >= 2) {
          const second = Number(parts[1]);
          if (second >= 16 && second <= 31) {
            return true;
          }
        }
      }
    }

    if (isIPv6(h)) {
      const lower = h.toLowerCase();
      if (lower === "::1" || lower === "0:0:0:0:0:0:0:1") {
        return true;
      }
    }

    return false;
  } catch {
    return false;
  }
}
