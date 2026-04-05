import { createHmac, timingSafeEqual } from "node:crypto";
import type { ChannelAdapter } from "./types.js";

function safeEqual(a: string, b: string): boolean {
  const aBuf = Buffer.from(a, "utf8");
  const bBuf = Buffer.from(b, "utf8");
  if (aBuf.length !== bBuf.length) {
    return false;
  }
  return timingSafeEqual(aBuf, bBuf);
}

export function verifySlackSignature(input: {
  signingSecret: string;
  timestamp: string;
  body: string;
  signatureHeader: string | undefined;
}): boolean {
  if (!input.signatureHeader) {
    return false;
  }
  const ts = Number.parseInt(input.timestamp, 10);
  if (!Number.isFinite(ts)) {
    return false;
  }
  const fiveMinutes = 60 * 5;
  const now = Math.floor(Date.now() / 1000);
  if (Math.abs(now - ts) > fiveMinutes) {
    return false;
  }
  const base = `v0:${input.timestamp}:${input.body}`;
  const hmac = createHmac("sha256", input.signingSecret)
    .update(base, "utf8")
    .digest("hex");
  const expected = `v0=${hmac}`;
  return safeEqual(expected, input.signatureHeader);
}

export function createSlackAdapter(input: {
  sendImpl?: (
    text: string
  ) => Promise<{ ok: true } | { ok: false; error: string }>;
}): ChannelAdapter {
  return {
    channel: "slack",
    send: (message) => {
      if (input.sendImpl) {
        return input.sendImpl(message.text);
      }
      return Promise.resolve({
        ok: true,
        providerMessageId: "slack-simulated",
      });
    },
  };
}
