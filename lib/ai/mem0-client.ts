import MemoryClient from "mem0ai";
import type { Message, Memory as Mem0Memory } from "mem0ai";

import { getRedisClient } from "@/lib/ratelimit";

let _client: MemoryClient | null = null;

const DEFAULT_MONTHLY_SEARCH_LIMIT = 1000;
const MONTH_TTL_SECONDS = 35 * 24 * 60 * 60;

let _searchBudgetExhaustedMonth = "";

function getMonthKey(): string {
  const now = new Date();
  const year = now.getUTCFullYear();
  const month = String(now.getUTCMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
}

function getSearchLimit(): number {
  const env = process.env.MEM0_MONTHLY_SEARCH_LIMIT;
  if (env) {
    const parsed = Number.parseInt(env, 10);
    if (Number.isFinite(parsed) && parsed > 0) {
      return parsed;
    }
  }
  return DEFAULT_MONTHLY_SEARCH_LIMIT;
}

async function checkMem0Budget(
  kind: "search" | "add"
): Promise<{ allowed: boolean; count: number }> {
  const redis = getRedisClient();
  if (!redis) {
    return { allowed: true, count: 0 };
  }

  const limit =
    kind === "search" ? getSearchLimit() : Number.POSITIVE_INFINITY;

  const monthKey = getMonthKey();
  const redisKey = `mem0:${kind}:${monthKey}`;

  try {
    const [count] = await redis
      .multi()
      .incr(redisKey)
      .expire(redisKey, MONTH_TTL_SECONDS, "NX")
      .exec();

    const current = typeof count === "number" ? count : 0;

    if (current > limit) {
      if (_searchBudgetExhaustedMonth !== monthKey && kind === "search") {
        _searchBudgetExhaustedMonth = monthKey;
        console.warn(
          `[mem0] monthly search budget exhausted (${current}/${limit}), falling back to Postgres FTS`
        );
      }
      return { allowed: false, count: current };
    }

    if (kind === "search" && current % 100 === 0) {
      console.info(`[mem0] monthly search usage: ${current}/${limit}`);
    }

    return { allowed: true, count: current };
  } catch {
    return { allowed: true, count: 0 };
  }
}

function getClient(): MemoryClient | null {
  const apiKey = process.env.MEM0_API_KEY;
  if (!apiKey) {
    return null;
  }
  if (!_client) {
    _client = new MemoryClient({ apiKey });
  }
  return _client;
}

export function isMem0Configured(): boolean {
  return Boolean(process.env.MEM0_API_KEY);
}

export async function mem0Add(
  messages: Message[],
  userId: string,
  metadata?: Record<string, unknown>
): Promise<Mem0Memory[] | null> {
  const client = getClient();
  if (!client) {
    return null;
  }
  try {
    return await client.add(messages, { user_id: userId, metadata });
  } catch (error) {
    console.error("[mem0] add failed:", error);
    return null;
  }
}

export async function mem0Search(
  query: string,
  userId: string,
  options?: { limit?: number; categories?: string[] }
): Promise<Mem0Memory[]> {
  const client = getClient();
  if (!client) {
    return [];
  }

  const budget = await checkMem0Budget("search");
  if (!budget.allowed) {
    return [];
  }

  try {
    return await client.search(query, {
      user_id: userId,
      limit: options?.limit ?? 8,
      ...(options?.categories ? { categories: options.categories } : {}),
    });
  } catch (error) {
    console.error("[mem0] search failed:", error);
    return [];
  }
}

export async function mem0AddText(
  text: string,
  userId: string,
  metadata?: Record<string, unknown>
): Promise<Mem0Memory[] | null> {
  return mem0Add(
    [{ role: "user", content: text }],
    userId,
    metadata
  );
}
