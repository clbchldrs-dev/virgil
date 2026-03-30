import MemoryClient from "mem0ai";
import type { Message, Memory as Mem0Memory } from "mem0ai";

let _client: MemoryClient | null = null;

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
