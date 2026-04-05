import { createHmac, timingSafeEqual } from "node:crypto";
import type { ChannelAdapter } from "./types.js";

export function verifyTwilioSignature(input: {
  authToken: string;
  url: string;
  params: Record<string, string>;
  signatureHeader: string | undefined;
}): boolean {
  if (!input.signatureHeader) {
    return false;
  }
  const sortedKeys = Object.keys(input.params).sort();
  let data = input.url;
  for (const key of sortedKeys) {
    data += key;
    data += input.params[key] ?? "";
  }
  const expected = createHmac("sha1", input.authToken)
    .update(data, "utf8")
    .digest("base64");
  const expectedBuf = Buffer.from(expected, "utf8");
  const receivedBuf = Buffer.from(input.signatureHeader, "utf8");
  if (expectedBuf.length !== receivedBuf.length) {
    return false;
  }
  return timingSafeEqual(expectedBuf, receivedBuf);
}

export function createSmsAdapter(input: {
  sendImpl?: (
    text: string
  ) => Promise<{ ok: true } | { ok: false; error: string }>;
}): ChannelAdapter {
  return {
    channel: "sms",
    send: (message) => {
      if (input.sendImpl) {
        return input.sendImpl(message.text);
      }
      return Promise.resolve({ ok: true, providerMessageId: "sms-simulated" });
    },
  };
}
