import "server-only";

import { Client } from "@upstash/qstash";

/**
 * Client for publishing QStash messages. Requires `QSTASH_TOKEN`.
 *
 * **Region:** The JS SDK defaults to the EU endpoint (`https://qstash.upstash.io`)
 * when `QSTASH_URL` is unset. If your token was created in the **US** QStash
 * region, set `QSTASH_URL=https://qstash-us-east-1.upstash.io` (match the URL
 * shown in the Upstash console). See https://upstash.com/docs/qstash/howto/multi-region
 */
export function getQStashPublishClient(): Client {
  const token = process.env.QSTASH_TOKEN?.trim();
  if (!token) {
    throw new Error("QSTASH_TOKEN is not set");
  }
  return new Client({ token });
}
