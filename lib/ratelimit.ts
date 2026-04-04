/**
 * IP-based chat abuse guard (production only, see `checkIpRateLimit`).
 *
 * **Fail-open:** If `REDIS_URL` is unset, the client is not created. If Redis is down or not
 * yet `isReady`, `checkIpRateLimit` returns without incrementing (no 429). If `incr` throws a
 * non-`VirgilError`, the catch swallows it — traffic is allowed. Intentional: chat stays
 * available when Redis is degraded; per-user hourly caps in Postgres still apply for gateway
 * traffic unless `SKIP_CHAT_MESSAGE_RATE_LIMIT` is set.
 */
import { createClient } from "redis";

import { isProductionEnvironment } from "@/lib/constants";
import { VirgilError } from "@/lib/errors";

const MAX_MESSAGES = 10;
const TTL_SECONDS = 60 * 60;

let client: ReturnType<typeof createClient> | null = null;

function getClient() {
  if (!client && process.env.REDIS_URL) {
    client = createClient({ url: process.env.REDIS_URL });
    client.on("error", () => undefined);
    client.connect().catch(() => {
      client = null;
    });
  }
  return client;
}

export function getRedisClient() {
  const redis = getClient();
  if (!redis?.isReady) {
    return null;
  }
  return redis;
}

export async function checkIpRateLimit(ip: string | undefined) {
  if (!isProductionEnvironment || !ip) {
    return;
  }

  const redis = getClient();
  if (!redis?.isReady) {
    return;
  }

  try {
    const key = `ip-rate-limit:${ip}`;
    const [count] = await redis
      .multi()
      .incr(key)
      .expire(key, TTL_SECONDS, "NX")
      .exec();

    if (typeof count === "number" && count > MAX_MESSAGES) {
      throw new VirgilError("rate_limit:chat");
    }
  } catch (error) {
    if (error instanceof VirgilError) {
      throw error;
    }
  }
}
