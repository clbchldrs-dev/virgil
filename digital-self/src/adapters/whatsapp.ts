import { createHmac, timingSafeEqual } from "node:crypto";
import type { ChannelAdapter } from "./types.js";

export function verifyWhatsAppSignature(input: {
  appSecret: string;
  body: string;
  signatureHeader: string | undefined;
}): boolean {
  if (!input.signatureHeader?.startsWith("sha256=")) {
    return false;
  }
  const expected = createHmac("sha256", input.appSecret)
    .update(input.body, "utf8")
    .digest("hex");
  const received = input.signatureHeader.slice("sha256=".length);
  const expectedBuf = Buffer.from(expected, "hex");
  const receivedBuf = Buffer.from(received, "hex");
  if (expectedBuf.length !== receivedBuf.length) {
    return false;
  }
  return timingSafeEqual(expectedBuf, receivedBuf);
}

export function createWhatsAppAdapter(input: {
  sendImpl?: (
    text: string
  ) => Promise<{ ok: true } | { ok: false; error: string }>;
}): ChannelAdapter {
  return {
    channel: "whatsapp",
    send: (message) => {
      if (input.sendImpl) {
        return input.sendImpl(message.text);
      }
      return Promise.resolve({
        ok: true,
        providerMessageId: "whatsapp-simulated",
      });
    },
  };
}
