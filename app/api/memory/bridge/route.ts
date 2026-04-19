import {
  saveMemoryRecord,
  searchMemories,
  searchMemoriesByVectorFromQueryText,
} from "@/lib/db/queries";
import { memoryBridgeBodySchema } from "@/lib/memory-bridge/schema";
import { serializeMemoryForBridge } from "@/lib/memory-bridge/serialize-memory";
import { isVirgilMemoryBridgeEnabled } from "@/lib/virgil/integrations";

function getBridgeSecret(): string | undefined {
  return process.env.VIRGIL_MEMORY_BRIDGE_SECRET?.trim();
}

function getBridgeUserId(): string | undefined {
  return process.env.VIRGIL_MEMORY_BRIDGE_USER_ID?.trim();
}

/**
 * Bearer-authenticated memory search + save for scripts and local agents (single-owner).
 * Same Postgres as the web app when `POSTGRES_URL` matches production.
 *
 * Auth: `Authorization: Bearer $VIRGIL_MEMORY_BRIDGE_SECRET`
 * Target user: `VIRGIL_MEMORY_BRIDGE_USER_ID` (Postgres `User.id`).
 * Enable: `VIRGIL_MEMORY_BRIDGE_ENABLED=1`
 */
export async function POST(request: Request) {
  if (!isVirgilMemoryBridgeEnabled()) {
    return Response.json({ error: "memory_bridge_disabled" }, { status: 403 });
  }

  const secret = getBridgeSecret();
  const userId = getBridgeUserId();
  if (!secret || !userId) {
    return Response.json(
      { error: "memory_bridge_misconfigured" },
      { status: 500 }
    );
  }

  const auth = request.headers.get("authorization");
  if (auth !== `Bearer ${secret}`) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "invalid_json" }, { status: 400 });
  }

  const parsed = memoryBridgeBodySchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: "invalid_body" }, { status: 400 });
  }

  const input = parsed.data;

  if (input.op === "search") {
    const limit = input.limit ?? 8;
    let rows = await searchMemoriesByVectorFromQueryText({
      userId,
      query: input.query,
      kind: input.kind,
      limit,
    });
    if (rows.length === 0) {
      rows = await searchMemories({
        userId,
        query: input.query,
        kind: input.kind,
        limit,
      });
    }
    return Response.json({
      memories: rows.map(serializeMemoryForBridge),
    });
  }

  const metadata: Record<string, unknown> = {
    ...(input.metadata ?? {}),
    source: "memory-bridge",
  };

  const created = await saveMemoryRecord({
    userId,
    chatId: input.chatId,
    kind: input.kind,
    content: input.content,
    metadata,
  });

  if (!created) {
    return Response.json({ error: "save_failed" }, { status: 500 });
  }

  return Response.json({ memory: serializeMemoryForBridge(created) });
}
