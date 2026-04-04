/**
 * Redis client for features that need Upstash (e.g. mem0 quotas). Chat no longer applies
 * IP or hourly message caps here.
 */
import { createClient } from "redis";

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
